use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use symphonia::core::{
    audio::SampleBuffer, codecs::DecoderOptions, formats::FormatOptions, io::MediaSourceStream,
    meta::MetadataOptions, probe::Hint,
};
use audioadapter_buffers::direct::InterleavedSlice;
use rubato::{Async, FixedAsync, Indexing, Resampler, SincInterpolationParameters, SincInterpolationType, WindowFunction, calculate_cutoff};

fn resample(samples: Vec<f32>, from_rate: u32, to_rate: u32, channels: usize) -> Vec<f32> {
    if from_rate == to_rate { return samples; }

    let frames = samples.len() / channels;
    let ratio = to_rate as f64 / from_rate as f64;

    let params = SincInterpolationParameters {
        sinc_len: 64,
        f_cutoff: calculate_cutoff(64, WindowFunction::Blackman2),
        interpolation: SincInterpolationType::Linear,
        oversampling_factor: 128,
        window: WindowFunction::Blackman2,
    };
    let mut resampler = Async::<f32>::new_sinc(ratio, 1.1, &params, 1024, channels, FixedAsync::Input).unwrap();

    let capacity = (frames as f64 * ratio * 1.1) as usize + 1024;
    let mut out = vec![0.0f32; capacity * channels];

    let input = InterleavedSlice::new(&samples, channels, frames).unwrap();
    let mut output = InterleavedSlice::new_mut(&mut out, channels, capacity).unwrap();

    let mut idx = Indexing { input_offset: 0, output_offset: 0, active_channels_mask: None, partial_len: None };
    let mut frames_left = frames;

    while frames_left >= resampler.input_frames_next() {
        let (ni, no) = resampler.process_into_buffer(&input, &mut output, Some(&idx)).unwrap();
        idx.input_offset += ni;
        idx.output_offset += no;
        frames_left -= ni;
    }

    // flush remainder
    if frames_left > 0 {
        let flush_idx = Indexing { partial_len: Some(frames_left), ..idx };
        let (_, no) = resampler.process_into_buffer(&input, &mut output, Some(&flush_idx)).unwrap();
        idx.output_offset += no;
    }

    out.truncate(idx.output_offset * channels);
    out
}

fn play_mp3(path: &str) {
    // Find Virtual Cable
    let host = cpal::default_host();
    let device = host
        .output_devices()
        .unwrap()
        .find(|d| d.name().unwrap_or_default().contains("CABLE Input"))
        .expect("Virtual Cable not found");

    let config = device.default_output_config().unwrap();

    // Decode MP3
    let file = std::fs::File::open(path).unwrap();
    let mss = MediaSourceStream::new(Box::new(file), Default::default());
    let probed = symphonia::default::get_probe()
        .format(
            &Hint::new(),
            mss,
            &FormatOptions::default(),
            &MetadataOptions::default(),
        )
        .unwrap();

    let mut format = probed.format;
    let track = format.default_track().unwrap();
    let mp3_sample_rate = track.codec_params.sample_rate.unwrap();
    let mp3_channels = track.codec_params.channels.unwrap().count();
    let mut decoder = symphonia::default::get_codecs()
        .make(&track.codec_params, &DecoderOptions::default())
        .unwrap();
    let track_id = track.id;

    let mut samples: Vec<f32> = Vec::new();
    loop {
        let packet = match format.next_packet() {
            Ok(p) => p,
            Err(_) => break,
        };
        if packet.track_id() != track_id {
            continue;
        }
        if let Ok(decoded) = decoder.decode(&packet) {
            let mut buf = SampleBuffer::<f32>::new(decoded.capacity() as u64, *decoded.spec());
            buf.copy_interleaved_ref(decoded);
            samples.extend_from_slice(buf.samples());
        }
    }

    let cable_channels = config.channels() as usize;
    let samples = if mp3_channels == 2 && cable_channels == 1 {
        samples.chunks_exact(2).map(|c| (c[0] + c[1]) * 0.5).collect()
    } else {
        samples
    };
    let cable_rate = config.sample_rate().0;
    println!("playing mp3: {}hz {}ch | cable: {}hz {}ch", mp3_sample_rate, mp3_channels, cable_rate, cable_channels);
    let samples = resample(samples, mp3_sample_rate, cable_rate, mp3_channels);

    // Stream to Virtual Cable
    let samples = std::sync::Arc::new(samples);
    let samples_cb = samples.clone();
    let idx = std::sync::Arc::new(std::sync::atomic::AtomicUsize::new(0));
    let idx_cb = idx.clone();

    let stream = device
        .build_output_stream(
            &config.into(),
            move |data: &mut [f32], _| {
                let i = idx_cb.load(std::sync::atomic::Ordering::Relaxed);
                let len = data.len().min(samples_cb.len().saturating_sub(i));
                data[..len].copy_from_slice(&samples_cb[i..i + len]);
                data[len..].fill(0.0);
                idx_cb.fetch_add(len, std::sync::atomic::Ordering::Relaxed);
            },
            |e| eprintln!("{e}"),
            None,
        )
        .unwrap();

    stream.play().unwrap();

    // Wait until playback finishes
    let total = samples.len();
    while idx.load(std::sync::atomic::Ordering::Relaxed) < total {
        std::thread::sleep(std::time::Duration::from_millis(50));
    }
}

#[tauri::command]
fn play_sound(path: String) {
    std::thread::spawn(move || {
        play_mp3(&path);
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![play_sound])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
