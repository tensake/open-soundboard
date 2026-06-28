//! Audio module that handles playback for sounds, microphone forwarding and app forwarding.

use cpal::traits::{DeviceTrait, HostTrait};
use std::sync::atomic::{AtomicU32, AtomicU64, AtomicU8, Ordering};
use std::sync::mpsc;
use std::sync::Arc;

mod decode;
pub mod device;
pub mod forwarding;
pub mod mic;
mod output;

/// State of the sound playback.
#[repr(u8)]
pub enum PlaybackState {
    Playing = 0,
    Paused = 1,
    Stopped = 2,
}

impl From<u8> for PlaybackState {
    fn from(v: u8) -> Self {
        match v {
            1 => Self::Paused,
            2 => Self::Stopped,
            _ => Self::Playing,
        }
    }
}

/// Handle to control playback of a sound.
pub struct PlaybackHandle {
    state: Arc<AtomicU8>,
    volume: Arc<AtomicU32>,
    speed: Arc<AtomicU32>,
    frames_progress: Arc<AtomicU64>,
    frames_total: Arc<AtomicU64>,
    sample_rate: u32,
    seek_tx: mpsc::Sender<f32>,
}

impl PlaybackHandle {
    /// Pause audio playback.
    pub fn pause(&self) {
        self.state
            .store(PlaybackState::Paused as u8, Ordering::Relaxed);
    }

    /// Resume audio playback after pausing.
    pub fn resume(&self) {
        self.state
            .store(PlaybackState::Playing as u8, Ordering::Relaxed);
    }

    /// Stop audio playback.
    pub fn stop(&self) {
        self.state
            .store(PlaybackState::Stopped as u8, Ordering::Relaxed);
    }

    /// Seek to a specific time in seconds.
    pub fn seek(&self, secs: f32) {
        let _ = self.seek_tx.send(secs);
    }

    /// Set the volume level for the playback.
    pub fn set_volume(&self, volume: f32) {
        let clamped = volume.clamp(0.0, 1.0);
        self.volume.store(clamped.to_bits(), Ordering::Relaxed);
    }

    /// Check if the sound is completed.
    pub fn is_done(&self) -> bool {
        matches!(
            PlaybackState::from(self.state.load(Ordering::Relaxed)),
            PlaybackState::Stopped
        )
    }

    /// Get the current playback progress in seconds.
    pub fn progress_secs(&self) -> f64 {
        self.frames_progress.load(Ordering::Relaxed) as f64 / self.sample_rate as f64
    }

    /// Get the total duration of the audio file in seconds.
    pub fn total_secs(&self) -> f64 {
        let total = self.frames_total.load(Ordering::Relaxed);
        if total == 0 {
            0.0
        } else {
            total as f64 / self.sample_rate as f64
        }
    }

    /// Set the playback speed.
    pub fn set_speed(&self, speed: f32) {
        let clamped = speed.clamp(0.5, 2.0);
        self.speed.store(clamped.to_bits(), Ordering::Relaxed);
    }
}

/// Play an audio file to the default output device and virtual cable.
///
/// Returns a handle to control playback.
pub fn play_sound(
    path: &str,
    device: Arc<cpal::Device>,
    volume: f32,
    speed: f32,
) -> Result<PlaybackHandle, Box<dyn std::error::Error>> {
    let file_path = std::path::Path::new(path);
    if !file_path.exists() {
        return Err(format!("Cannot find file: {}", path).into());
    }

    let volume = Arc::new(AtomicU32::new(volume.clamp(0.0, 1.0).to_bits()));
    let speed = Arc::new(AtomicU32::new(speed.clamp(0.5, 2.0).to_bits()));

    // Get cable device info
    let config = device
        .default_output_config()
        .map_err(|e| format!("Failed to get output device config: {e}"))?;
    let cable_rate = config.sample_rate();
    let cable_channels = config.channels() as usize;

    // Get local device info
    let local_device = Arc::new(
        cpal::default_host()
            .default_output_device()
            .ok_or("No default output device found")?,
    );
    let local_config = local_device
        .default_output_config()
        .map_err(|e| format!("Failed to get local device config: {e}"))?;
    let local_channels = local_config.channels() as usize;

    // Initialize channels, state and handle fields
    let (tx, rx) = mpsc::sync_channel::<Vec<f32>>(8);
    let (tx_local, rx_local) = mpsc::sync_channel::<Vec<f32>>(8);
    let state = Arc::new(AtomicU8::new(PlaybackState::Playing as u8));
    let (ready_tx, ready_rx) = mpsc::sync_channel::<Result<(), String>>(1);
    let frames_progress = Arc::new(AtomicU64::new(0));
    let frames_total = Arc::new(AtomicU64::new(0));
    let (seek_tx, seek_rx) = mpsc::channel::<f32>();

    // Spawn audio processing thread
    let path = path.to_owned();
    let state_process = state.clone();
    let frames_total_process = frames_total.clone();
    let frames_progress_process = frames_progress.clone();
    let speed_process = speed.clone();
    std::thread::spawn(move || {
        if let Err(e) = decode::decode_loop(
            &path,
            decode::DecodeConfig {
                cable_rate,
                cable_channels,
                local_channels,
                frames_total: frames_total_process,
                frames_progress: frames_progress_process,
                speed: speed_process,
            },
            tx,
            tx_local,
            seek_rx,
            state_process,
        ) {
            eprintln!("Error while processing audio file: {e}");
        }
    });

    // Virtual cable playback
    output::spawn_stream(
        device,
        config,
        rx,
        state.clone(),
        volume.clone(),
        Some(ready_tx),
    );

    // Local stream playback
    output::spawn_stream(
        local_device,
        local_config,
        rx_local,
        state.clone(),
        volume.clone(),
        None,
    );

    // Wait until the output stream is fully ready
    ready_rx
        .recv()
        .map_err(|_| "Audio thread died unexpectedly")??;

    Ok(PlaybackHandle {
        state,
        volume,
        speed,
        frames_progress,
        frames_total,
        sample_rate: cable_rate,
        seek_tx,
    })
}
