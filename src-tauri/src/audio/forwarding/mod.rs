use crate::audio::PlaybackState;
use cpal::traits::DeviceTrait;
use std::sync::atomic::{AtomicU32, AtomicU8, Ordering};
use std::sync::{mpsc, Arc};

#[cfg(target_os = "windows")]
pub mod windows;

#[cfg(target_os = "linux")]
pub mod linux;

#[derive(serde::Serialize)]
pub struct AudioApp {
    pub id: u32,
    pub name: String,
    /// Base64 encoded icon
    pub icon: Option<String>,
}

/// Handle for controlling a forwarder.
pub struct ForwardingHandle {
    state: Arc<AtomicU8>,
    volume: Arc<AtomicU32>,
}

impl ForwardingHandle {
    pub fn stop(&self) {
        self.state
            .store(PlaybackState::Stopped as u8, Ordering::Relaxed);
    }

    pub fn set_volume(&self, vol: f32) {
        let clamped = vol.clamp(0.0, 1.0);
        self.volume.store(clamped.to_bits(), Ordering::Relaxed);
    }
}

pub fn get_audio_apps() -> Result<Vec<AudioApp>, Box<dyn std::error::Error>> {
    #[cfg(target_os = "windows")]
    {
        let apps = windows::list_sessions()?;
        return Ok(apps);
    }

    #[cfg(target_os = "linux")]
    {
        return Err("App forwarding is not implemented for your OS yet.".into());
    }
}

pub fn forward_app(
    id: u32,
    cable_device: Arc<cpal::Device>,
    volume: Arc<AtomicU32>,
) -> Result<ForwardingHandle, Box<dyn std::error::Error>> {
    let state = Arc::new(AtomicU8::new(PlaybackState::Playing as u8));
    let (tx, rx) = mpsc::sync_channel::<Vec<f32>>(8);
    let config = cable_device
        .default_output_config()
        .map_err(|e| format!("Failed to get cable device config: {e}"))?;

    let cable_rate = config.sample_rate();
    let cable_channels = config.channels() as usize;

    let state_fwd = state.clone();
    #[cfg(target_os = "windows")]
    std::thread::spawn(move || {
        if let Err(e) = windows::forwarding_loop(id, cable_rate, cable_channels, tx, state_fwd) {
            eprintln!("Error while forwarding app audio: {e}");
        }
    });

    #[cfg(target_os = "linux")]
    return Err();

    crate::audio::output::spawn_stream(
        cable_device,
        config,
        rx,
        state.clone(),
        volume.clone(),
        None,
    );

    Ok(ForwardingHandle { state, volume })
}
