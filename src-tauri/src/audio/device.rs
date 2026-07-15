//! Logic for getting the virtual cable device on Windows or
//! creating a null sink on Linux as well as listening for device changes.

use crate::audio;
use crate::cmd;
use crate::AppState;
use cpal::traits::{DeviceTrait, HostTrait};
use parking_lot::Mutex;
use std::sync::Arc;
use tauri::{Emitter, Manager};

/// Get the default microphone device.
pub fn get_input_device() -> Result<cpal::Device, String> {
    cpal::default_host()
        .default_input_device()
        .ok_or("No default input device found".to_string())
}

/// Get the default output device.
pub fn get_output_device() -> Result<cpal::Device, String> {
    cpal::default_host()
        .default_output_device()
        .ok_or("No default output device found".to_string())
}

/// Poll for default device changes and update the app state.
pub fn listen_devices(app: tauri::AppHandle) {
    log::info!("Starting to listen to device changes...");
    let mut shown_alerts: std::collections::HashSet<String> = std::collections::HashSet::new();
    loop {
        let state = match app.try_state::<AppState>() {
            Some(s) => s,
            None => continue,
        };

        // Helper function to poll for a device and update state
        let mut poll_device = |label: &str,
                               f: fn() -> Result<cpal::Device, String>,
                               slot: &Mutex<Option<Arc<cpal::Device>>>|
         -> bool {
            let alert_key = format!("{label} device error");
            let new = match f() {
                Ok(dev) => {
                    // Dismiss the alert if it was previously shown
                    if shown_alerts.remove(&alert_key) {
                        let _ = app.emit("alert-dismiss", &alert_key);
                    }

                    Some(Arc::new(dev))
                }
                Err(e) => {
                    log::warn!("Failed to get {label} device: {e}");
                    if shown_alerts.insert(alert_key.clone()) {
                        let _ = app.emit(
                            "alert",
                            cmd::Alert {
                                kind: cmd::AlertKind::Error,
                                title: alert_key,
                                message: e,
                            },
                        );
                    }
                    None
                }
            };
            let changed = device_name_changed(&slot.lock(), &new);
            if changed {
                let name = new
                    .as_ref()
                    .and_then(|d| d.description().ok())
                    .map(|desc| desc.name().to_string());
                log::info!("Using {label} device: {name:?}");
                *slot.lock() = new;
            }
            changed
        };

        let input_changed = poll_device(
            "Input",
            audio::device::get_input_device,
            &state.input_device,
        );
        let cable_changed = poll_device("Cable", audio::device::get_cable, &state.cable_device);
        let output_changed = poll_device(
            "Output",
            audio::device::get_output_device,
            &state.output_device,
        );

        if input_changed || cable_changed {
            start_mic_forwarding(&state);
        }

        if output_changed {
            log::info!("Output device changed, stopping all sounds...");
            cmd::stop_all_sounds(state.clone());
        }

        std::thread::sleep(std::time::Duration::from_secs(5));
    }
}

fn start_mic_forwarding(state: &AppState) {
    let mut mic = state.mic_handle.lock();
    if let Some(handle) = mic.take() {
        handle.stop();
    }

    let input = state.input_device.lock();
    let cable = state.cable_device.lock();
    if let (Some(input_dev), Some(cable_dev)) = (input.as_ref(), cable.as_ref()) {
        match audio::mic::start_forwarding(input_dev.clone(), cable_dev.clone()) {
            Ok(handle) => {
                log::info!("Mic forwarding restarted with new device");
                *mic = Some(handle);
            }
            Err(e) => {
                log::warn!("Failed to restart mic forwarding: {e}");
            }
        }
    }
}

fn device_name_changed(cur: &Option<Arc<cpal::Device>>, new: &Option<Arc<cpal::Device>>) -> bool {
    let current_name = cur
        .as_ref()
        .and_then(|d| d.description().ok())
        .map(|desc| desc.name().to_string());
    let new_name = new
        .as_ref()
        .and_then(|d| d.description().ok())
        .map(|desc| desc.name().to_string());
    current_name != new_name
}

/// On Windows, get VB-Audio virtual cable device.
#[cfg(target_os = "windows")]
pub fn get_cable() -> Result<cpal::Device, String> {
    let host = cpal::default_host();
    host.output_devices()
        .unwrap()
        .find(|d| {
            d.description()
                .map(|desc| desc.name().contains("CABLE Input"))
                .unwrap_or(false)
        })
        .ok_or("Virtual Cable not found. Install on https://vb-audio.com/Cable/".to_string())
}

#[cfg(target_os = "linux")]
fn create_virtual_sink() {
    let sink_exists = std::process::Command::new("pactl")
        .args(["list", "sinks", "short"])
        .output()
        .map(|o| {
            String::from_utf8_lossy(&o.stdout)
                .lines()
                .any(|l| l.contains("OpenSoundBoard"))
        })
        .unwrap_or(false);

    let source_exists = std::process::Command::new("pactl")
        .args(["list", "sources", "short"])
        .output()
        .map(|o| {
            String::from_utf8_lossy(&o.stdout)
                .lines()
                .any(|l| l.contains("OpenSoundBoard_Input"))
        })
        .unwrap_or(false);

    // Skip creation if sink already exist
    if sink_exists && source_exists {
        return;
    }

    // Clean up previous sinks
    let _ = std::process::Command::new("pactl")
        .args(["unload-module", "module-remap-source"])
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status();

    // Create null sink
    if !sink_exists {
        let _ = std::process::Command::new("pactl")
            .args([
                "load-module",
                "module-null-sink",
                "sink_name=OpenSoundBoard",
                "sink_properties=device.description=OpenSoundBoard_Output device.class=abstract",
            ])
            .stdout(std::process::Stdio::null())
            .status();
    }

    // Create virtual microphone
    let _ = std::process::Command::new("pactl")
        .args([
            "load-module",
            "module-remap-source",
            "master=OpenSoundBoard.monitor",
            "source_name=OpenSoundBoard_Input",
            "source_properties=device.description=OpenSoundBoard_Input device.class=abstract device.type=virtual",
        ])
        .stdout(std::process::Stdio::null())
        .status();
}

/// On Linux, get virtual sink.
#[cfg(target_os = "linux")]
pub fn get_cable() -> Result<cpal::Device, String> {
    create_virtual_sink();

    let host = cpal::default_host();
    host.output_devices()
        .unwrap()
        .find(|d| {
            d.description()
                .map(|desc| desc.name().contains("OpenSoundBoard"))
                .unwrap_or(false)
        })
        .ok_or("Virtual sink not found".to_string())
}

/// On macOS, get BlackHole virtual audio device.
#[cfg(target_os = "macos")]
pub fn get_cable() -> Result<cpal::Device, String> {
    let host = cpal::default_host();
    host.output_devices()
        .unwrap()
        .find(|d| {
            d.description()
                .map(|desc| desc.name().contains("BlackHole"))
                .unwrap_or(false)
        })
        .ok_or(
            "BlackHole not found. Install on https://github.com/ExistentialAudio/BlackHole"
                .to_string(),
        )
}

/// Fallback for any other unsupported OS.
#[cfg(not(any(target_os = "windows", target_os = "linux", target_os = "macos")))]
pub fn get_cable() -> cpal::Device {
    panic!("Your OS is not supported.")
}
