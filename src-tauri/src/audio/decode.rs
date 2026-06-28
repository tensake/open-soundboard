//! Provides methods for decoding audio file and resampling audio data.

use audioadapter_buffers::direct::InterleavedSlice;
use rubato::{
    calculate_cutoff, Async, FixedAsync, Indexing, Resampler, SincInterpolationParameters,
    SincInterpolationType, WindowFunction,
};
use std::sync::atomic::{AtomicU32, AtomicU64, AtomicU8, Ordering};
use std::sync::mpsc;
use std::sync::Arc;
use symphonia::core::formats::{SeekMode, SeekTo};
use symphonia::core::units::Time;
use symphonia::core::{
    audio::SampleBuffer, codecs::DecoderOptions, formats::FormatOptions, io::MediaSourceStream,
    meta::MetadataOptions, probe::Hint,
};

use crate::audio::PlaybackState;

pub struct DecodeConfig {
    pub cable_rate: u32,
    pub cable_channels: usize,
    pub local_channels: usize,
    pub frames_total: Arc<AtomicU64>,
    pub frames_progress: Arc<AtomicU64>,
    pub speed: Arc<AtomicU32>,
}

/// Resamples a chunk of audio data using the provided resampler.
pub fn resample_chunk(
    leftover: &mut Vec<f32>,
    chunk: &[f32],
    resampler: &mut Async<f32>,
    channels: usize,
    base_ratio: f64,
    speed: f64,
) -> Result<Vec<f32>, Box<dyn std::error::Error>> {
    leftover.extend_from_slice(chunk);

    // Calculate and set resample ratio
    resampler
        .set_resample_ratio(base_ratio * (1.0 / speed.max(0.01)), false)
        .map_err(|e| format!("Failed to set resample ratio: {e}"))?;

    // Get required samples for each iteration
    let needed_frames = resampler.input_frames_next();
    let needed_samples = needed_frames * channels;

    let mut out = Vec::new();

    // Process all full samples
    while leftover.len() >= needed_samples {
        let input: Vec<f32> = leftover.drain(..needed_samples).collect();
        let capacity = resampler.output_frames_max();
        let mut buf_out = vec![0.0f32; capacity * channels];

        let input_slice = InterleavedSlice::new(&input, channels, needed_frames)
            .map_err(|e| format!("Failed to create interleaved input slice: {e:?}"))?;
        let mut output_slice = InterleavedSlice::new_mut(&mut buf_out, channels, capacity)
            .map_err(|e| format!("Failed to create interleaved output slice: {e:?}"))?;
        let idx = Indexing {
            input_offset: 0,
            output_offset: 0,
            active_channels_mask: None,
            partial_len: None,
        };

        // Resample
        let (_, produced_frames) = resampler
            .process_into_buffer(&input_slice, &mut output_slice, Some(&idx))
            .map_err(|e| format!("Resample failed: {e}"))?;

        buf_out.truncate(produced_frames * channels);

        // Add resampled chunk to output
        out.extend(buf_out);
    }

    Ok(out)
}

/// Decodes an audio file and sends the resampled chunks to tx.
///
/// This function is blocking and should be run in a separate thread.
pub fn decode_loop(
    path: &str,
    cfg: DecodeConfig,
    tx: mpsc::SyncSender<Vec<f32>>,
    tx_local: mpsc::SyncSender<Vec<f32>>,
    rx_seek: mpsc::Receiver<f32>,
    state: Arc<AtomicU8>,
) -> Result<(), Box<dyn std::error::Error>> {
    // Decode audio file
    let file =
        std::fs::File::open(path).map_err(|e| format!("Cannot open audio file: {path}: {e}"))?;
    let mss = MediaSourceStream::new(Box::new(file), Default::default());

    // Probe the media source
    let mut hint = Hint::new();
    if let Some(ext) = std::path::Path::new(path)
        .extension()
        .and_then(|e| e.to_str())
    {
        hint.with_extension(ext);
    }
    let probed = symphonia::default::get_probe()
        .format(
            &hint,
            mss,
            &FormatOptions::default(),
            &MetadataOptions::default(),
        )
        .map_err(|e| format!("Unsupported audio format: {path}: {e}"))?;
    let mut format = probed.format;
    let track = format.default_track().ok_or("No default track found")?;
    let audio_rate = track
        .codec_params
        .sample_rate
        .ok_or("Sample rate not found in audio file")?;
    let audio_channels = track
        .codec_params
        .channels
        .ok_or("Channel count not found in audio file")?
        .count();
    let mut decoder = symphonia::default::get_codecs()
        .make(&track.codec_params, &DecoderOptions::default())
        .map_err(|e| format!("Failed to create decoder: {path}: {e}"))?;
    let track_id = track.id;

    // Configure resampler
    let params = SincInterpolationParameters {
        sinc_len: 64,
        f_cutoff: calculate_cutoff(64, WindowFunction::Blackman2),
        interpolation: SincInterpolationType::Linear,
        oversampling_factor: 128,
        window: WindowFunction::Blackman2,
    };
    let base_ratio = cfg.cable_rate as f64 / audio_rate as f64;
    let resample_channels = if audio_channels == 2 && cfg.cable_channels == 1 {
        1
    } else {
        audio_channels
    };

    // Initialize resampler
    let mut resampler = Some(
        Async::<f32>::new_sinc(
            base_ratio,
            3.0,
            &params,
            1024,
            resample_channels,
            FixedAsync::Input,
        )
        .map_err(|e| format!("Failed to create resampler: {e}"))?,
    );

    // Set total frame count
    if let Some(n) = track.codec_params.n_frames {
        let cable_total = (n as f64 * base_ratio) as u64;
        cfg.frames_total.store(cable_total, Ordering::Relaxed);
    }

    // Process audio chunks in a loop
    let mut leftover: Vec<f32> = Vec::new();
    loop {
        // Respect stop signal from handle
        if matches!(
            PlaybackState::from(state.load(Ordering::Relaxed)),
            PlaybackState::Stopped
        ) {
            break;
        }

        // Check for seek
        if let Ok(secs) = rx_seek.try_recv() {
            match format.seek(
                SeekMode::Accurate,
                SeekTo::Time {
                    time: Time::from(secs),
                    track_id: Some(track_id),
                },
            ) {
                Ok(_) => {
                    // Reset decoder
                    decoder.reset();
                    if let Some(r) = &mut resampler {
                        r.reset();
                    }
                    leftover.clear();

                    // Update progress
                    let current_frames = (secs as f64 * cfg.cable_rate as f64) as u64;
                    cfg.frames_progress.store(current_frames, Ordering::Relaxed);
                }
                Err(e) => eprintln!("Seek failed: {e}"),
            }
        }

        // Read the next packet and verify track id
        let packet = match format.next_packet() {
            Ok(p) => p,
            Err(symphonia::core::errors::Error::IoError(e))
                if e.kind() == std::io::ErrorKind::UnexpectedEof =>
            {
                break
            }
            Err(e) => return Err(format!("Packet read error: {e}").into()),
        };
        if packet.track_id() != track_id {
            continue;
        }

        // Decode packet
        let Ok(decoded) = decoder.decode(&packet) else {
            continue;
        };

        // Convert to interleaved
        let mut buf = SampleBuffer::new(decoded.capacity() as u64, *decoded.spec());
        buf.copy_interleaved_ref(decoded);
        let mut chunk = buf.samples().to_vec();

        // Downmix for cable if needed
        if audio_channels == 2 && cfg.cable_channels == 1 {
            chunk = chunk
                .chunks_exact(2)
                .map(|c| (c[0] + c[1]) * 0.707)
                .collect();
        }

        // Update progress
        let source_frames = (chunk.len() / resample_channels) as u64;
        let cable_equiv_frames = (source_frames as f64 * base_ratio) as u64;
        cfg.frames_progress
            .fetch_add(cable_equiv_frames, Ordering::Relaxed);

        // Resample to match cable sample rate if needed
        if let Some(r) = &mut resampler {
            let current_speed = f32::from_bits(cfg.speed.load(Ordering::Relaxed)) as f64;
            chunk = resample_chunk(
                &mut leftover,
                &chunk,
                r,
                resample_channels,
                base_ratio,
                current_speed,
            )?;
            if chunk.is_empty() {
                continue;
            }
        }

        // Upmix for local output if needed
        let local_chunk = if cfg.cable_channels == 1 && 2 == cfg.local_channels {
            chunk.iter().flat_map(|&s| [s, s]).collect()
        } else {
            chunk.clone()
        };

        // Send to local and cable output stream
        if tx.send(chunk).is_err() || tx_local.send(local_chunk).is_err() {
            break;
        }
    }

    Ok(())
}
