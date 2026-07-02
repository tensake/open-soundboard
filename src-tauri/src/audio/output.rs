//! Logic for writing audio to the device.

use cpal::traits::{DeviceTrait, StreamTrait};
use std::sync::atomic::{AtomicU32, AtomicU8, Ordering};
use std::sync::mpsc;
use std::sync::{Arc, Mutex};

use crate::audio::PlaybackState;

/// Spawns an output stream thread that reads audio from the rx channel and writes it to the device.
pub fn spawn_stream(
    device: Arc<cpal::Device>,
    config: cpal::SupportedStreamConfig,
    rx: mpsc::Receiver<Vec<f32>>,
    state: Arc<AtomicU8>,
    volume: Arc<AtomicU32>,
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
            config.into(),
            move |data: &mut [f32], _| {
                match PlaybackState::from(state_cb.load(Ordering::Relaxed)) {
                    PlaybackState::Paused | PlaybackState::Stopped => {
                        data.fill(0.0);
                        return;
                    }
                    PlaybackState::Playing => {}
                }

                let raw_vol = f32::from_bits(volume.load(Ordering::Relaxed));
                let gain = raw_vol * raw_vol;
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
                                break;
                            }
                            // Flag as stopped if the channel is closed
                            Err(mpsc::TryRecvError::Disconnected) => {
                                data[written..].fill(0.0);
                                state_cb.store(PlaybackState::Stopped as u8, Ordering::Relaxed);
                                break;
                            }
                        }
                    }

                    // Copy as much as fits from leftover into output
                    let take = (data.len() - written).min(buf.len());
                    for (dst, src) in data[written..written + take].iter_mut().zip(&buf[..take]) {
                        *dst = src * gain;
                    }

                    // Remove what was consumed from the buffer
                    buf.drain(..take);

                    // Keep track of written data
                    written += take;
                }
            },
            |e| {
                let msg = e.to_string();
                // Ignore 'Device disconnected' messages on linux
                if !msg.contains("Device disconnected") {
                    log::error!("{e}");
                }
            },
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
