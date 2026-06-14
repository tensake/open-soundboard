use cpal::traits::{DeviceTrait, StreamTrait};
use rubato::{
    calculate_cutoff, Async, FixedAsync, SincInterpolationParameters, SincInterpolationType,
    WindowFunction,
};
use std::sync::atomic::{AtomicU32, AtomicU8, Ordering};
use std::sync::mpsc;
use std::sync::Arc;

use crate::audio::{decode, output, PlaybackState};

pub struct MicrophoneHandle {
    volume: Arc<AtomicU32>,
    state: Arc<AtomicU8>,
}

impl MicrophoneHandle {
    pub fn set_volume(&self, volume: f32) {
        let clamped = volume.clamp(0.0, 3.0);
        self.volume.store(clamped.to_bits(), Ordering::Relaxed);
    }

    pub fn volume(&self) -> f32 {
        let bits = self.volume.load(Ordering::Relaxed);
        f32::from_bits(bits)
    }

    pub fn stop(&self) {
        self.state
            .store(PlaybackState::Stopped as u8, Ordering::Relaxed);
    }
}

fn microphone_loop(
    input_device: Arc<cpal::Device>,
    cable_rate: u32,
    cable_channels: usize,
    tx: mpsc::SyncSender<Vec<f32>>,
    state: Arc<AtomicU8>,
) -> Result<(), Box<dyn std::error::Error>> {
    // Get microphone config
    let input_config = input_device
        .default_input_config()
        .map_err(|e| format!("Failed to get input device config: {e}"))?;
    let input_rate = input_config.sample_rate();
    let input_channels = input_config.channels() as usize;

    // Build resampler if needed
    let need_resample = input_rate != cable_rate;
    let params = SincInterpolationParameters {
        sinc_len: 64,
        f_cutoff: calculate_cutoff(64, WindowFunction::Blackman2),
        interpolation: SincInterpolationType::Linear,
        oversampling_factor: 128,
        window: WindowFunction::Blackman2,
    };
    let ratio = cable_rate as f64 / input_rate as f64;
    let resample_channels = cable_channels;
    let mut resampler = need_resample
        .then(|| {
            Async::<f32>::new_sinc(
                ratio,
                1.1,
                &params,
                1024,
                resample_channels,
                FixedAsync::Input,
            )
            .map_err(|e| format!("Failed to create resampler: {e}"))
        })
        .transpose()?;

    let mut leftover: Vec<f32> = Vec::new();
    let state_cb = state.clone();

    let stream = input_device.build_input_stream(
        input_config.into(),
        move |data: &[f32], _| {
            if matches!(
                PlaybackState::from(state_cb.load(Ordering::Relaxed)),
                PlaybackState::Stopped
            ) {
                return;
            }

            let mut chunk = data.to_vec();

            // Channel remix to match cable
            if input_channels == 2 && cable_channels == 1 {
                chunk = chunk.chunks_exact(2).map(|c| (c[0] + c[1]) * 0.5).collect();
            } else if input_channels == 1 && cable_channels == 2 {
                chunk = chunk.iter().flat_map(|&s| [s, s]).collect();
            }

            // Resample if needed
            if let Some(r) = &mut resampler {
                match decode::resample_chunk(&mut leftover, &chunk, r, resample_channels) {
                    Ok(out) => chunk = out,
                    Err(_) => return,
                }
                if chunk.is_empty() {
                    return;
                }
            }

            // Send mic chunk without awaiting to maintain real-time
            let _ = tx.try_send(chunk);
        },
        |e| eprintln!("Mic input stream error: {e}"),
        None,
    )?;
    stream.play()?;

    // Keep stream alive until stopped
    while !matches!(
        PlaybackState::from(state.load(Ordering::Relaxed)),
        PlaybackState::Stopped
    ) {
        std::thread::sleep(std::time::Duration::from_millis(10));
    }
    drop(stream);

    Ok(())
}

/// Start forwarding audio from the default input device to the virtual cable
pub fn start_forwarding(
    input_device: Arc<cpal::Device>,
    cable_device: Arc<cpal::Device>,
) -> Result<MicrophoneHandle, Box<dyn std::error::Error>> {
    // Initialize
    let (tx, rx) = mpsc::sync_channel::<Vec<f32>>(8);
    let state = Arc::new(AtomicU8::new(PlaybackState::Playing as u8));
    let (ready_tx, ready_rx) = mpsc::sync_channel::<Result<(), String>>(1);
    let volume = Arc::new(AtomicU32::new(1.0f32.to_bits()));
    let config = cable_device
        .default_output_config()
        .map_err(|e| format!("Failed to get cable device config: {e}"))?;

    // Spawn microphone capture loop
    let state_mic = state.clone();
    std::thread::spawn(move || {
        if let Err(e) = microphone_loop(
            input_device,
            config.sample_rate(),
            config.channels() as usize,
            tx,
            state_mic,
        ) {
            eprintln!("Error while forwarding microphone: {e}");
        }
    });

    // Output mic to virtual cable
    output::spawn_stream(
        cable_device,
        config,
        rx,
        state.clone(),
        volume.clone(),
        Some(ready_tx),
        None,
    );

    // Wait until the output stream is fully ready
    ready_rx
        .recv()
        .map_err(|_| "Audio thread died unexpectedly")??;

    Ok(MicrophoneHandle { state, volume })
}
