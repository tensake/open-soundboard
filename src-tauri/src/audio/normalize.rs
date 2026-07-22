//! Get normalization gain from an audio file.

use ebur128::{EbuR128, Mode};

use crate::audio::helpers;

/// Calculates the normalization gain from the audio file.
///
/// Fully decodes the file to measure loudness and uses the EBU R128 algorithm to calculate gain.
/// This is expensive, so always call from a spawned thread.
pub fn calculate_gain(path: &str) -> Result<f32, Box<dyn std::error::Error>> {
    let mut audio_params = helpers::probe_audio_file(path)?;

    let mut analyzer = EbuR128::new(audio_params.channels as u32, audio_params.rate, Mode::I)?;

    log::debug!("Starting decoding to normalize: {path}");
    loop {
        let packet = match audio_params.format.next_packet() {
            Ok(Some(p)) => p,
            Ok(None) => break,
            Err(e) => return Err(format!("Packet read error: {e}").into()),
        };
        if packet.track_id != audio_params.track_id {
            continue;
        }

        let Ok(decoded) = audio_params.decoder.decode(&packet) else {
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
