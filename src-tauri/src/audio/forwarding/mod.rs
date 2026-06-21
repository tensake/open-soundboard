use std::sync::atomic::{AtomicU32, AtomicU8, Ordering};
use cpal::traits::{DeviceTrait};
use std::sync::{mpsc, Arc};
use crate::audio::PlaybackState;

#[cfg(target_os = "windows")]
pub mod windows;

#[cfg(target_os = "linux")]
pub mod linux;

pub struct ForwardingHandle {
    id: u32,
    state: Arc<AtomicU8>,
    volume: Arc<AtomicU32>,
}

impl ForwardingHandle {
    pub fn stop(&self) {
        self.state
            .store(PlaybackState::Stopped as u8, Ordering::Relaxed);
    }

    pub fn pause(&self) {
        self.state
            .store(PlaybackState::Paused as u8, Ordering::Relaxed);
    }

    pub fn resume(&self) {
        self.state
            .store(PlaybackState::Playing as u8, Ordering::Relaxed);
    }

    pub fn set_volume(&self, vol: f32) {
        let clamped = vol.clamp(0.0, 1.0);
        self.volume.store(clamped.to_bits(), Ordering::Relaxed);
    }
}

pub fn get_audio_apps() -> Result<Vec<u32>, Box<dyn std::error::Error>> {
    #[cfg(target_os = "windows")]
    let apps = windows::list_sessions()?;

    Ok(apps)
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

    #[cfg(target_os = "windows")]
    windows::forwarding_loop(id, tx, state.clone())?;
    #[cfg(target_os = "linux")]
    linux::forwarding_loop(id, tx, tx_local, state.clone())?;

    crate::audio::output::spawn_stream(
        cable_device,
        config,
        rx,
        state.clone(),
        volume.clone(),
        None,
    );

    Ok(ForwardingHandle { id, state, volume })
}
