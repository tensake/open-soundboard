//! Logic for microphone forwarding and controlling playback.

use cpal::traits::{DeviceTrait, StreamTrait};
use pitch_shift::{Shifter, TOTAL_F32};
use rubato::{
    Async, FixedAsync, SincInterpolationParameters, SincInterpolationType, WindowFunction,
    calculate_cutoff,
};
use std::convert::TryInto;
use std::sync::Arc;
use std::sync::atomic::{AtomicU8, AtomicU32, Ordering};
use std::sync::mpsc;

use crate::audio::{PlaybackState, decode, output};

type PitchState = Box<[f32; TOTAL_F32]>;

/// Handle for controlling the microphone output.
pub struct MicrophoneHandle {
    volume: Arc<AtomicU32>,
    pitch: Arc<AtomicU32>,
    state: Arc<AtomicU8>,
}

impl MicrophoneHandle {
    /// Set the volume level for the microphone.
    pub fn set_volume(&self, volume: f32) {
        let clamped = volume.clamp(0.0, 3.0);
        self.volume.store(clamped.to_bits(), Ordering::Relaxed);
    }

    /// Get the current volume level for the microphone.
    pub fn volume(&self) -> f32 {
        f32::from_bits(self.volume.load(Ordering::Relaxed))
    }

    /// Change the pitch of the microphone.
    pub fn set_pitch(&self, semitones: f32) {
        let clamped = semitones.clamp(-12.0, 12.0);
        self.pitch.store(clamped.to_bits(), Ordering::Relaxed);
    }

    /// Get the current pitch of the microphone.
    pub fn pitch(&self) -> f32 {
        f32::from_bits(self.pitch.load(Ordering::Relaxed))
    }

    /// Stop microphone playback.
    pub fn stop(&self) {
        self.state
            .store(PlaybackState::Stopped as u8, Ordering::Relaxed);
    }
}

fn shifter() -> Result<PitchState, Box<dyn std::error::Error>> {
    let state_vec = vec![0.0; TOTAL_F32];
    state_vec
        .try_into()
        .map_err(|_| "Failed to convert state_vec to box".into())
}

/// Microphone loop that reads audio from the input device and sends it to tx.
fn microphone_loop(
    input_device: Arc<cpal::Device>,
    cable_rate: u32,
    cable_channels: usize,
    tx: mpsc::SyncSender<Vec<f32>>,
    state: Arc<AtomicU8>,
    pitch: Arc<AtomicU32>,
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
        f_cutoff: Some(calculate_cutoff::<f32>(64, WindowFunction::Blackman2)),
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

    // Initialize pitch shifters for each channel
    let mut shifters: Vec<Shifter<PitchState>> = (0..cable_channels)
        .map(|_| shifter().map(Shifter::new))
        .collect::<Result<_, _>>()?;

    // Start the stream
    let mut pitch_leftover: Vec<Vec<f32>> = vec![Vec::new(); cable_channels];
    let mut leftover: Vec<f32> = Vec::new();
    let state_cb = state.clone();
    let pitch_cb = pitch.clone();
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
            let semitones = f32::from_bits(pitch_cb.load(Ordering::Relaxed));

            // Channel remix to match cable
            if input_channels == 2 && cable_channels == 1 {
                chunk = chunk.chunks_exact(2).map(|c| (c[0] + c[1]) * 0.5).collect();
            } else if input_channels == 1 && cable_channels == 2 {
                chunk = chunk.iter().flat_map(|&s| [s, s]).collect();
            }

            // Resample if needed
            if let Some(r) = &mut resampler {
                match decode::resample_chunk(
                    &mut leftover,
                    &chunk,
                    r,
                    resample_channels,
                    ratio,
                    1.0,
                ) {
                    Ok(out) => chunk = out,
                    Err(_) => return,
                }
                if chunk.is_empty() {
                    return;
                }
            }

            // Pitch shift if needed only
            if semitones.abs() < 0.01 {
                let _ = tx.try_send(chunk);
                return;
            }

            // Extract data from each channel
            let channel_bufs: Vec<Vec<f32>> = (0..cable_channels)
                .map(|c| {
                    chunk
                        .iter()
                        .skip(c)
                        .step_by(cable_channels)
                        .copied()
                        .collect()
                })
                .collect();

            // Shift each channel, and ensure chunks are exactly 128 samples
            let mut shifted_channels: Vec<Vec<f32>> = vec![Vec::new(); cable_channels];
            for (ch, buf) in channel_bufs.iter().enumerate() {
                let mut input_for_pitch = Vec::with_capacity(pitch_leftover[ch].len() + buf.len());
                input_for_pitch.extend_from_slice(&pitch_leftover[ch]);
                input_for_pitch.extend_from_slice(buf);
                pitch_leftover[ch].clear();

                let mut offset = 0;
                while input_for_pitch.len() - offset >= 128 {
                    let input = &input_for_pitch[offset..offset + 128];
                    let shifted = shifters[ch].shift(input, semitones, 128, cable_rate as f32);
                    shifted_channels[ch].extend_from_slice(shifted);
                    offset += 128;
                }
                // Save leftover
                if offset < input_for_pitch.len() {
                    pitch_leftover[ch].extend_from_slice(&input_for_pitch[offset..]);
                }
            }

            // Merge channels into one
            let out_frames = shifted_channels.iter().map(|c| c.len()).min().unwrap_or(0);
            if out_frames == 0 {
                return;
            }
            let mut pitched = vec![0.0f32; out_frames * cable_channels];
            for frame in 0..out_frames {
                for ch in 0..cable_channels {
                    pitched[frame * cable_channels + ch] = shifted_channels[ch][frame];
                }
            }

            // Send mic chunk without awaiting to maintain real-time
            let _ = tx.try_send(pitched);
        },
        |e| log::error!("Mic input stream error: {e}"),
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
    let pitch = Arc::new(AtomicU32::new(0.0f32.to_bits()));
    let config = cable_device
        .default_output_config()
        .map_err(|e| format!("Failed to get cable device config: {e}"))?;

    // Spawn microphone capture loop
    let state_mic = state.clone();
    let pitch_mic = pitch.clone();
    std::thread::spawn(move || {
        if let Err(e) = microphone_loop(
            input_device,
            config.sample_rate(),
            config.channels() as usize,
            tx,
            state_mic,
            pitch_mic,
        ) {
            log::error!("Error while forwarding microphone: {e}");
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
    );

    // Wait until the output stream is fully ready
    ready_rx
        .recv()
        .map_err(|_| "Audio thread died unexpectedly")??;

    Ok(MicrophoneHandle {
        state,
        volume,
        pitch,
    })
}
