//! Audio related logic helpers.
//!
//! Provides helpers for:
//! - Probing audio files by [`probe_audio_file`]
//! - Resampling audio chunks by [`resample_chunk`]

use rubato::Adjustable;
use rubato::audioadapter_buffers::direct::InterleavedSlice;
use rubato::{Async, Indexing, Resampler};
use symphonia::core::codecs::audio::AudioDecoder;
use symphonia::core::formats::FormatReader;
use symphonia::core::formats::TrackType;
use symphonia::core::{
    codecs::audio::AudioDecoderOptions,
    formats::{FormatOptions, probe::Hint},
    io::MediaSourceStream,
    meta::MetadataOptions,
};

/// Parameters extracted from an audio file.
pub struct AudioFileParams {
    pub format: Box<dyn FormatReader>,
    pub decoder: Box<dyn AudioDecoder>,
    pub track_id: u32,
    pub rate: u32,
    pub channels: usize,
    pub num_frames: Option<u64>,
}

/// Opens and probes an audio file.
///
/// Returns [`AudioFileParams`] on success.
pub fn probe_audio_file(path: &str) -> Result<AudioFileParams, Box<dyn std::error::Error>> {
    // Decode the audio file.
    let file =
        std::fs::File::open(path).map_err(|e| format!("Cannot open audio file: {path}: {e}"))?;
    let mss = MediaSourceStream::new(Box::new(file), Default::default());

    // Hint using the file extension.
    let mut hint = Hint::new();
    if let Some(ext) = std::path::Path::new(path)
        .extension()
        .and_then(|e| e.to_str())
    {
        hint.with_extension(ext);
    }

    // Probe the audio file.
    let format = symphonia::default::get_probe()
        .probe(
            &hint,
            mss,
            FormatOptions::default(),
            MetadataOptions::default(),
        )
        .map_err(|e| format!("Unsupported audio format: {path}: {e}"))?;
    let track = format
        .default_track(TrackType::Audio)
        .ok_or("No default track found")?;
    let codec_params = track
        .codec_params
        .as_ref()
        .and_then(|p| p.audio())
        .ok_or("No audio codec parameters")?;
    let rate = codec_params
        .sample_rate
        .ok_or("Sample rate not found in audio file")?;
    let channels = codec_params
        .channels
        .clone()
        .ok_or("Channel count not found in audio file")?
        .count();
    let decoder = symphonia::default::get_codecs()
        .make_audio_decoder(codec_params, &AudioDecoderOptions::default())
        .map_err(|e| format!("Failed to create decoder: {path}: {e}"))?;
    let track_id = track.id;
    let num_frames = track.num_frames;

    Ok(AudioFileParams {
        format,
        decoder,
        track_id,
        rate,
        channels,
        num_frames,
    })
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
