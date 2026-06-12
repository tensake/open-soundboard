use cpal::traits::{DeviceTrait, HostTrait};

/// On Windows, get VB-Audio virtual cable device.
#[cfg(target_os = "windows")]
pub fn get_cable() -> cpal::Device {
    let host = cpal::default_host();
    host.output_devices()
        .unwrap()
        .find(|d| {
            d.description()
                .map(|desc| desc.name().contains("CABLE Input"))
                .unwrap_or(false)
        })
        .expect("Virtual Cable not found. Install on https://vb-audio.com/Cable/")
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
pub fn get_cable() -> cpal::Device {
    create_virtual_sink();

    let host = cpal::default_host();
    host.output_devices()
        .unwrap()
        .find(|d| {
            d.description()
                .map(|desc| desc.name().contains("OpenSoundBoard"))
                .unwrap_or(false)
        })
        .expect("Virtual sink not found")
}

/// On macOS, get BlackHole virtual audio device.
#[cfg(target_os = "macos")]
pub fn get_cable() -> cpal::Device {
    let host = cpal::default_host();
    host.output_devices()
        .unwrap()
        .find(|d| {
            d.description()
                .map(|desc| desc.name().contains("BlackHole"))
                .unwrap_or(false)
        })
        .expect(
            "BlackHole not found — install it from https://github.com/ExistentialAudio/BlackHole",
        )
}

/// Fallback for any other unsupported OS.
#[cfg(not(any(target_os = "windows", target_os = "linux", target_os = "macos")))]
pub fn get_cable() -> cpal::Device {
    panic!("Your OS is not supported.")
}

/// Get the default microphone device.
pub fn get_input_device() -> cpal::Device {
    cpal::default_host()
        .default_input_device()
        .expect("No default input device found")
}
