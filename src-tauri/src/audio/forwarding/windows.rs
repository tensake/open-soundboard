//! Windows implementation of audio forwarding for specific processes.
//!
//! Some of the code from this module is based on:
//! - https://github.com/HEnquist/wasapi-rs/blob/master/examples/record_application.rs
//! - https://github.com/HEnquist/wasapi-rs/blob/master/examples/processes.rs

use std::collections::{HashSet, VecDeque};
use std::error::Error;
use std::sync::atomic::{AtomicU8, Ordering};
use std::sync::{Arc, mpsc};
use sysinfo::{Pid, ProcessRefreshKind, RefreshKind, System};
use wasapi::{
    AudioClient, DeviceEnumerator, Direction, SampleType, SessionState, StreamMode, WaveFormat,
    initialize_mta,
};
use windows_icons::get_icon_base64_by_process_id;

use crate::audio::PlaybackState;
use crate::audio::forwarding::AudioApp;

/// Resolve the parent process ID for the given child process ID.
fn resolve_target_pid(pid: u32) -> u32 {
    let refreshes = RefreshKind::nothing().with_processes(ProcessRefreshKind::everything());
    let system = System::new_with_specifics(refreshes);
    system
        .process(Pid::from_u32(pid))
        .and_then(|p| p.parent())
        .map(|p| p.as_u32())
        .unwrap_or(pid)
}

/// Get information like icon and name for a list of PIDs.
fn get_info_pids(pids: HashSet<u32>) -> Vec<AudioApp> {
    let refreshes = RefreshKind::nothing().with_processes(ProcessRefreshKind::everything());
    let system = System::new_with_specifics(refreshes);

    pids.into_iter()
        .map(|pid| {
            let name = system
                .process(Pid::from_u32(pid))
                .map(|p| p.name().to_string_lossy().into_owned())
                .unwrap_or_else(|| format!("PID {pid}"));

            let icon = get_icon_base64_by_process_id(pid).ok();

            AudioApp {
                id: pid,
                name,
                icon,
            }
        })
        .collect()
}

/// Return a list of [AudioApp] from [SessionState::Active] sessions.
///
/// Also do this in a thread to prevent `RPC_E_CHANGED_MODE` error.
/// Thread is required to be `MTA`, and because `COM` can only be initialized
/// once per thread, we need to create a new thread and initialize `COM` in it as `MTA`.
pub fn list_sessions() -> Result<Vec<AudioApp>, Box<dyn Error>> {
    std::thread::spawn(list_sessions_thread)
        .join()
        .map_err(|_| "Session enumeration thread panicked".to_string())
        .and_then(|i| i)
        .map_err(|e| -> Box<dyn Error> { e.into() })
}

fn list_sessions_thread() -> Result<Vec<AudioApp>, String> {
    // Thread required to be MTA
    initialize_mta()
        .ok()
        .map_err(|e| format!("Failed to init COM: {e}"))?;

    let mut pids: HashSet<u32> = HashSet::new();
    let enumerator =
        DeviceEnumerator::new().map_err(|e| format!("Failed to create device enumerator: {e}"))?;

    // Enumerate all render devices that are using output devices
    for device in &enumerator
        .get_device_collection(&Direction::Render)
        .map_err(|e| format!("Failed to get render device collection: {e}"))?
    {
        let Ok(dev) = device else { continue };

        // Get registered audio sessions for the device
        let Ok(manager) = dev.get_iaudiosessionmanager() else {
            continue;
        };
        let Ok(session_enumerator) = manager.get_audiosessionenumerator() else {
            continue;
        };

        // Get the number of session for device
        let count = session_enumerator
            .get_count()
            .map_err(|e| format!("Failed to get session count: {e}"))?;

        // Collect all active sessions into PIDs
        for i in 0..count {
            let Ok(control) = session_enumerator.get_session(i) else {
                continue;
            };

            if !matches!(control.get_state(), Ok(SessionState::Active)) {
                continue;
            }

            if let Ok(pid) = control.get_process_id() {
                // Skip system PID and own PID
                if pid != 0 && pid != std::process::id() {
                    pids.insert(pid);
                }
            }
        }
    }

    let mut apps = get_info_pids(pids);
    apps.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(apps)
}

/// Capture audio from a single process using WASAPI and send to the tx channel.
pub fn forwarding_loop(
    pid: u32,
    cable_rate: u32,
    cable_channels: usize,
    tx: mpsc::SyncSender<Vec<f32>>,
    state: Arc<AtomicU8>,
) -> Result<(), Box<dyn Error>> {
    // Initialize COM and mark as MTA for process loopback
    initialize_mta()
        .ok()
        .map_err(|e| format!("Failed to init COM: {e}"))?;

    // Create instance of client for getting audio data from the target process and its children
    let mut audio_client =
        AudioClient::new_application_loopback_client(resolve_target_pid(pid), true)
            .map_err(|e| format!("Failed to create process loopback client: {e}"))?;

    // Configure format for client, autoconverts for cable
    let desired_format = WaveFormat::new(
        32,
        32,
        &SampleType::Float,
        cable_rate as usize,
        cable_channels,
        None,
    );
    let mode = StreamMode::EventsShared {
        autoconvert: true,
        buffer_duration_hns: 0,
    };

    // Initialize client and event handle
    audio_client
        .initialize_client(&desired_format, &Direction::Capture, &mode)
        .map_err(|e| format!("Failed to initialize process loopback client: {e}"))?;
    let event_handle = audio_client
        .set_get_eventhandle()
        .map_err(|e| format!("Failed to get event handle: {e}"))?;
    let capture_client = audio_client
        .get_audiocaptureclient()
        .map_err(|e| format!("Failed to get capture client: {e}"))?;

    // Start stream
    audio_client
        .start_stream()
        .map_err(|e| format!("Failed to start process loopback stream: {e}"))?;

    let frame_bytes = 4 * cable_channels;
    let mut data: VecDeque<u8> = VecDeque::with_capacity(frame_bytes * 4096);
    while !matches!(
        PlaybackState::from(state.load(Ordering::Relaxed)),
        PlaybackState::Stopped
    ) {
        // Wait for event for 1s and then check for state change
        if event_handle.wait_for_event(1000).is_err() {
            continue;
        }

        // Drain new data from queue
        loop {
            let frames_available = capture_client
                .get_next_packet_size()
                .map_err(|e| format!("Failed to get next packet size: {e}"))?;
            let Some(frames) = frames_available else {
                break;
            };
            if frames == 0 {
                break;
            }

            // Read data into the queue
            capture_client
                .read_from_device_to_deque(&mut data)
                .map_err(|e| format!("Failed to read from device: {e}"))?;
        }

        // Get usable bytes
        let usable_bytes = (data.len() / frame_bytes) * frame_bytes;
        if usable_bytes == 0 {
            continue;
        }

        // Convert usable bytes to f32 samples
        let raw: Vec<u8> = data.drain(..usable_bytes).collect();
        let samples: Vec<f32> = raw
            .chunks_exact(4)
            .map(|b| f32::from_le_bytes([b[0], b[1], b[2], b[3]]))
            .collect();

        let _ = tx.try_send(samples);
    }

    audio_client
        .stop_stream()
        .map_err(|e| format!("Failed to stop process loopback stream: {e}"))?;

    Ok(())
}
