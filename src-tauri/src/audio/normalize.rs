//! Get normalization gain from an audio file.

use ebur128::{EbuR128, Mode};
use symphonia::core::formats::TrackType;
use symphonia::core::{
    codecs::audio::AudioDecoderOptions,
    formats::{FormatOptions, probe::Hint},
    io::MediaSourceStream,
    meta::MetadataOptions,
};

/// Calculates the normalization gain from the audio file.
///
/// Fully decodes the file to measure loudness and uses the EBU R128 algorithm to calculate gain.
/// This is expensive, so always call from a spawned thread.
pub fn calculate_gain(path: &str) -> Result<f32, Box<dyn std::error::Error + Send + Sync>> {
    let file = std::fs::File::open(path)?;
    let mss = MediaSourceStream::new(Box::new(file), Default::default());

    let mut hint = Hint::new();
    if let Some(ext) = std::path::Path::new(path)
        .extension()
        .and_then(|e| e.to_str())
    {
        hint.with_extension(ext);
    }

    let mut format = symphonia::default::get_probe().probe(
        &hint,
        mss,
        FormatOptions::default(),
        MetadataOptions::default(),
    )?;
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
    let track_id = track.id;
    let mut decoder = symphonia::default::get_codecs()
        .make_audio_decoder(codec_params, &AudioDecoderOptions::default())
        .map_err(|e| format!("Failed to create decoder: {path}: {e}"))?;

    let mut analyzer = EbuR128::new(channels as u32, rate, Mode::I)?;

    log::debug!("Starting decoding to normalize: {path}");
    loop {
        let packet = match format.next_packet() {
            Ok(Some(p)) => p,
            Ok(None) => break,
            Err(e) => return Err(format!("Packet read error: {e}").into()),
        };
        if packet.track_id != track_id {
            continue;
        }

        let Ok(decoded) = decoder.decode(&packet) else {
            continue;
        };

        // Convert decoded samples to f32
        let mut bytes = vec![0u8; decoded.frames() * decoded.spec().channels().count() * 4];
        decoded.copy_bytes_interleaved_as::<f32, _>(&mut bytes);
        let samples: Vec<f32> = bytes
            .chunks_exact(4)
            .map(|b| f32::from_le_bytes(b.try_into().unwrap()))
            .collect();

        analyzer.add_frames_f32(&samples)?;
    }

    let measured_lufs = analyzer.loudness_global()?;

    // Return 1.0 for silent files
    if !measured_lufs.is_finite() {
        return Ok(1.0);
    }

    // Use Spotify's normalization which is -14 LUFS
    let gain_db = -14.0 - measured_lufs;
    let gain_linear = 10f64.powf(gain_db / 20.0);

    Ok(gain_linear as f32)
}
