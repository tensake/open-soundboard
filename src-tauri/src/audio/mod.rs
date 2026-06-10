use audioadapter_buffers::direct::InterleavedSlice;
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use rubato::{
    calculate_cutoff, Async, FixedAsync, Indexing, Resampler, SincInterpolationParameters,
    SincInterpolationType, WindowFunction,
};
use std::sync::atomic::{AtomicU8, Ordering};
use std::sync::mpsc;
use std::sync::{Arc, Mutex};
use symphonia::core::{
    audio::SampleBuffer, codecs::DecoderOptions, formats::FormatOptions, io::MediaSourceStream,
    meta::MetadataOptions, probe::Hint,
};

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
}

impl PlaybackHandle {
    pub fn pause(&self) {
        self.state
            .store(PlaybackState::Paused as u8, Ordering::Relaxed);
    }
    pub fn resume(&self) {
        self.state
            .store(PlaybackState::Playing as u8, Ordering::Relaxed);
    }
    pub fn stop(&self) {
        self.state
            .store(PlaybackState::Stopped as u8, Ordering::Relaxed);
    }

    // Will be used later for removing finished sounds
    #[allow(unused)]
    pub fn is_done(&self) -> bool {
        matches!(
            PlaybackState::from(self.state.load(Ordering::Relaxed)),
            PlaybackState::Stopped
        )
    }
}

fn resample_chunk(
    chunk: &[f32],
    resampler: &mut Async<f32>,
    channels: usize,
) -> Result<Vec<f32>, Box<dyn std::error::Error>> {
    let frames = chunk.len() / channels;
    // Create output buffer
    // + 10% for safety and 256 if the chunk is too small
    let ratio = resampler.output_frames_max() as f64 / resampler.input_frames_max() as f64;
    let capacity = (frames as f64 * ratio * 1.1) as usize + 256;
    let mut out = vec![0.0f32; capacity * channels];

    let input = InterleavedSlice::new(chunk, channels, frames)
        .map_err(|e| format!("Failed to create interleaved input slice: {e:?}"))?;
    let mut output = InterleavedSlice::new_mut(&mut out, channels, capacity)
        .map_err(|e| format!("Failed to create interleaved output slice: {e:?}"))?;
    let idx = Indexing {
        input_offset: 0,
        output_offset: 0,
        active_channels_mask: None,
        partial_len: None,
    };

    // Resample
    let (_, produced_frames) = resampler
        .process_into_buffer(&input, &mut output, Some(&idx))
        .map_err(|e| format!("Resample failed: {e}"))?;
    out.truncate(produced_frames * channels);

    Ok(out)
}

/// Get virtual cable device that contains CABLE Input in the name.
pub fn get_cable_device() -> cpal::Device {
    let host = cpal::default_host();
    host.output_devices()
        .unwrap()
        .find(|d| d.name().unwrap_or_default().contains("CABLE Input"))
        .expect("Virtual Cable not found")
}

fn process_audio_loop(
    path: &str,
    cable_rate: u32,
    cable_channels: usize,
    local_channels: usize,
    tx: mpsc::SyncSender<Vec<f32>>,
    tx_local: mpsc::SyncSender<Vec<f32>>,
    state: Arc<AtomicU8>,
) -> Result<(), Box<dyn std::error::Error>> {
    // Decode MP3
    let file =
        std::fs::File::open(path).map_err(|e| format!("Cannot open audio file: {path}: {e}"))?;
    let mss = MediaSourceStream::new(Box::new(file), Default::default());

    // Probe the media source
    let probed = symphonia::default::get_probe()
        .format(
            &Hint::new(),
            mss,
            &FormatOptions::default(),
            &MetadataOptions::default(),
        )
        .map_err(|e| format!("Unsupported audio format: {path}: {e}"))?;
    let mut format = probed.format;
    let track = format.default_track().ok_or("No default track found")?;
    let mp3_rate = track
        .codec_params
        .sample_rate
        .ok_or("Sample rate not found in audio file")?;
    let mp3_channels = track
        .codec_params
        .channels
        .ok_or("Channel count not found in audio file")?
        .count();
    let mut decoder = symphonia::default::get_codecs()
        .make(&track.codec_params, &DecoderOptions::default())
        .map_err(|e| format!("Failed to create decoder: {path}: {e}"))?;
    let track_id = track.id;

    // Build resampler if needed
    let need_resample = mp3_rate != cable_rate;
    let params = SincInterpolationParameters {
        sinc_len: 64,
        f_cutoff: calculate_cutoff(64, WindowFunction::Blackman2),
        interpolation: SincInterpolationType::Linear,
        oversampling_factor: 128,
        window: WindowFunction::Blackman2,
    };
    let ratio = cable_rate as f64 / mp3_rate as f64;
    let resample_channels = if mp3_channels == 2 && cable_channels == 1 {
        1
    } else {
        mp3_channels
    };
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

    // Process audio chunks
    loop {
        // Respect stop signal from handle
        if matches!(
            PlaybackState::from(state.load(Ordering::Relaxed)),
            PlaybackState::Stopped
        ) {
            break;
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
        if mp3_channels == 2 && cable_channels == 1 {
            chunk = chunk
                .chunks_exact(2)
                .map(|c| (c[0] + c[1]) * 0.707)
                .collect();
        }

        // Resample to match cable sample rate if needed
        if let Some(r) = &mut resampler {
            chunk = resample_chunk(&chunk, r, resample_channels)?;
        }

        // Upmix for local output if needed
        let local_chunk = if cable_channels == 1 && 2 == local_channels {
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

fn spawn_output_stream(
    device: Arc<cpal::Device>,
    config: cpal::SupportedStreamConfig,
    rx: mpsc::Receiver<Vec<f32>>,
    state: Arc<AtomicU8>,
    ready_tx: Option<mpsc::SyncSender<Result<(), String>>>,
) {
    // Create output stream in a separate thread.
    // Spawn everything in a thread because Stream is !Send.
    let leftover = Arc::new(Mutex::new(Vec::<f32>::new()));
    let state_cb = state.clone();
    let state_kt = state.clone();
    std::thread::spawn(move || {
        let leftover_cb = leftover.clone();
        let stream = match device.build_output_stream(
            &config.into(),
            move |data: &mut [f32], _| {
                match PlaybackState::from(state_cb.load(Ordering::Relaxed)) {
                    PlaybackState::Paused | PlaybackState::Stopped => {
                        data.fill(0.0);
                        return;
                    }
                    PlaybackState::Playing => {}
                }

                let mut buf = leftover_cb.lock().unwrap();
                let mut written = 0;

                // Write until we fill output buffer
                while written < data.len() {
                    if buf.is_empty() {
                        // Receive next chunk
                        match rx.try_recv() {
                            Ok(chunk) => *buf = chunk,
                            // Fill with silence if no chunks are produced
                            Err(mpsc::TryRecvError::Empty) => {
                                data[written..].fill(0.0);
                                return;
                            }
                            // Flag as stopped if the channel is closed
                            Err(mpsc::TryRecvError::Disconnected) => {
                                data[written..].fill(0.0);
                                state_cb.store(PlaybackState::Stopped as u8, Ordering::Relaxed);
                                return;
                            }
                        }
                    }

                    // Copy as much as fits from leftover into output
                    let take = (data.len() - written).min(buf.len());
                    data[written..written + take].copy_from_slice(&buf[..take]);

                    // Remove what was consumed from the buffer
                    buf.drain(..take);

                    written += take;
                }
            },
            |e| eprintln!("{e}"),
            None,
        ) {
            Ok(s) => s,
            Err(e) => {
                if let Some(tx) = ready_tx {
                    let _ = tx.send(Err(format!("Failed to build output stream: {e}")));
                }
                return;
            }
        };

        // Play stream
        if let Err(e) = stream.play() {
            if let Some(tx) = ready_tx {
                let _ = tx.send(Err(format!("Failed to play stream: {e}")));
            }
            return;
        }

        // Mark stream as successful
        if let Some(tx) = ready_tx {
            let _ = tx.send(Ok(()));
        }

        // Keep stream alive until stopped
        while !matches!(
            PlaybackState::from(state_kt.load(Ordering::Relaxed)),
            PlaybackState::Stopped
        ) {
            std::thread::sleep(std::time::Duration::from_millis(10));
        }
        drop(stream);
    });
}

/// Play an MP3 file.
///
/// Returns a handle to control playback.
pub fn play_mp3(
    path: &str,
    device: Arc<cpal::Device>,
) -> Result<PlaybackHandle, Box<dyn std::error::Error>> {
    let config = device
        .default_output_config()
        .map_err(|e| format!("Failed to get output device config: {e}"))?;
    let cable_rate = config.sample_rate().0;
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

    // Initialize channels and state
    let (tx, rx) = mpsc::sync_channel::<Vec<f32>>(8);
    let (tx_local, rx_local) = mpsc::sync_channel::<Vec<f32>>(8);
    let state = Arc::new(AtomicU8::new(PlaybackState::Playing as u8));
    let (ready_tx, ready_rx) = mpsc::sync_channel::<Result<(), String>>(1);

    // Spawn audio processing thread
    let path = path.to_owned();
    let state_process = state.clone();
    std::thread::spawn(move || {
        if let Err(e) = process_audio_loop(
            &path,
            cable_rate,
            cable_channels,
            local_channels,
            tx,
            tx_local,
            state_process,
        ) {
            eprintln!("Error while processing audio file: {e}");
        }
    });

    // Virtual cable playback
    spawn_output_stream(device, config, rx, state.clone(), Some(ready_tx));

    // Local stream playback
    spawn_output_stream(local_device, local_config, rx_local, state.clone(), None);

    // Wait until the output stream is fully ready
    ready_rx
        .recv()
        .map_err(|_| "Audio thread died unexpectedly")?
        .map_err(|e| e)?;

    Ok(PlaybackHandle { state })
}
