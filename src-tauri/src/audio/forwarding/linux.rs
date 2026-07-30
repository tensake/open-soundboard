use crate::audio::PlaybackState;

use super::AudioApp;
use pipewire::{
    channel,
    context::ContextRc,
    core::CoreRc,
    keys,
    main_loop::MainLoopRc,
    properties::properties,
    registry::GlobalObject,
    spa::{
        param::{
            ParamType,
            audio::{AudioFormat, AudioInfoRaw},
        },
        pod::{Object, Pod, Property, Value, serialize::PodSerializer},
        utils::{Direction, SpaTypes},
    },
    stream::{StreamFlags, StreamRc},
    types::ObjectType,
};
use std::{
    any::Any,
    cell::RefCell,
    collections::HashMap,
    collections::HashSet,
    error::Error,
    rc::Rc,
    sync::atomic::{AtomicU8, Ordering},
    sync::{Arc, mpsc},
    time::Duration,
};

/// Lists all audio applications that are currently playing.
///
/// Returns a vector of [`AudioApp`] structs with object.serial as id.
pub fn list_applications() -> Result<Vec<AudioApp>, Box<dyn std::error::Error>> {
    pipewire::init();
    let mainloop = MainLoopRc::new(None)?;
    let context = ContextRc::new(&mainloop, None)?;
    let core = context.connect_rc(None)?;
    let registry = core.get_registry_rc()?;
    let apps: Rc<RefCell<HashMap<u64, AudioApp>>> = Rc::new(RefCell::new(HashMap::new()));
    let clients: Rc<RefCell<HashMap<u32, u32>>> = Rc::new(RefCell::new(HashMap::new()));
    let own_pid = std::process::id();

    let _registry_listener = registry
        .add_listener_local()
        .global({
            let apps = apps.clone();
            move |global: &GlobalObject<_>| {
                // Get clients for having PIDs
                if global.type_ == ObjectType::Client {
                    if let Some(props) = global.props {
                        if let Some(pid) = props
                            .get("pipewire.sec.pid")
                            .and_then(|s| s.parse::<u32>().ok())
                        {
                            clients.borrow_mut().insert(global.id, pid);
                        }
                    }
                }

                // Get PIDs for currently playing nodes
                if global.type_ == ObjectType::Node {
                    if let Some(props) = global.props {
                        if props.get("media.class") == Some("Stream/Output/Audio") {
                            let pid = props
                                .get("client.id")
                                .and_then(|s| s.parse::<u32>().ok())
                                .and_then(|id| clients.borrow().get(&id).copied());

                            if let Some(pid) = pid
                                && pid != own_pid
                            {
                                let name = props
                                    .get("media.name")
                                    .or_else(|| props.get("node.description"))
                                    .or_else(|| props.get("node.name"))
                                    .unwrap_or("Unnamed Stream");

                                apps.borrow_mut().insert(
                                    pid as u64,
                                    AudioApp {
                                        id: pid,
                                        name: name.to_string(),
                                        icon: None,
                                    },
                                );
                            }
                        }
                    }
                }
            }
        })
        .register();

    // Exit when done
    let pending = Rc::new(RefCell::new(2i32));
    let _done_listener = core
        .add_listener_local()
        .done({
            let mainloop = mainloop.clone();
            move |_, _| {
                let mut p = pending.borrow_mut();
                *p -= 1;
                if *p == 0 {
                    mainloop.quit();
                }
            }
        })
        .register();
    core.sync(0)?;
    core.sync(0)?;

    mainloop.run();

    Ok(apps.borrow().values().cloned().collect())
}

/// Helper to create POD to configure stream
fn create_pod(rate: u32, channels: u32) -> Vec<u8> {
    let mut info = AudioInfoRaw::new();
    info.set_format(AudioFormat::F32LE);
    info.set_rate(rate);
    info.set_channels(channels);

    let properties: Vec<Property> = info.into();
    let value = Value::Object(Object {
        type_: SpaTypes::ObjectParamFormat.as_raw(),
        id: ParamType::EnumFormat.as_raw(),
        properties,
    });

    let (pod_bytes, _) = PodSerializer::serialize(std::io::Cursor::new(Vec::new()), &value)
        .expect("failed to serialize audio pod");
    pod_bytes.into_inner()
}

/// Capture audio using pipewire and forward it to tx.
pub fn start_forwarding(
    pid: u32,
    cable_rate: u32,
    cable_channels: usize,
    tx: mpsc::SyncSender<Vec<f32>>,
    state: Arc<AtomicU8>,
) -> Result<(), Box<dyn Error>> {
    let (node_tx, node_rx) = mpsc::sync_channel::<Vec<f32>>(8);
    let (stop_tx, stop_rx) = channel::channel::<()>();

    // Spawn a thread to capture audio
    std::thread::spawn(move || {
        if let Err(e) =
            capture_audio_thread(pid, cable_rate, cable_channels as u32, node_tx, stop_rx)
        {
            log::error!("PipeWire capture thread failed: {e}");
        }
    });

    loop {
        // Check if not stopped
        if state.load(Ordering::Relaxed) == PlaybackState::Stopped as u8 {
            let _ = stop_tx.send(());
            break;
        }

        // Mix chunks from nodes into one chubby chunk
        let mut mixed: Option<Vec<f32>> = None;
        while let Ok(chunk) = node_rx.recv_timeout(Duration::from_millis(5)) {
            match mixed.as_mut() {
                None => mixed = Some(chunk),
                Some(mix) => {
                    let len = mix.len().max(chunk.len());
                    mix.resize(len, 0.0);
                    for (i, s) in chunk.into_iter().enumerate() {
                        mix[i] = (mix[i] + s).clamp(-1.0, 1.0);
                    }
                }
            }
        }

        if let Some(chunk) = mixed {
            let _ = tx.send(chunk);
        }
    }

    Ok(())
}

/// Thread to manage pipewire, listen to node changes and capture audio.
fn capture_audio_thread(
    pid: u32,
    rate: u32,
    channels: u32,
    node_tx: mpsc::SyncSender<Vec<f32>>,
    stop_rx: channel::Receiver<()>,
) -> Result<(), Box<dyn Error>> {
    pipewire::init();
    let mainloop = MainLoopRc::new(None)?;
    let context = ContextRc::new(&mainloop, None)?;
    let core = context.connect_rc(None)?;
    let registry = core.get_registry_rc()?;

    let clients: Rc<RefCell<HashMap<u32, u32>>> = Rc::new(RefCell::new(HashMap::new()));
    let nodes: Rc<RefCell<HashSet<u32>>> = Rc::new(RefCell::new(HashSet::new()));
    let streams: Rc<RefCell<HashMap<u32, (StreamRc, Box<dyn Any>)>>> =
        Rc::new(RefCell::new(HashMap::new()));

    let pod_bytes = create_pod(rate, channels);

    let _stop = stop_rx.attach(mainloop.loop_(), {
        let mainloop = mainloop.clone();
        move |_| mainloop.quit()
    });

    let _listener = registry
        .add_listener_local()
        .global({
            let clients = clients.clone();
            let nodes = nodes.clone();
            let streams = streams.clone();
            let core = core.clone();
            let node_tx = node_tx.clone();
            let pod_bytes = pod_bytes.clone();

            move |global| {
                let Some(props) = global.props else { return };

                match global.type_ {
                    // Filter for client that belongs to PID, needed for nodes
                    ObjectType::Client => {
                        let Some(client_pid) = props
                            .get("pipewire.sec.pid")
                            .and_then(|p| p.parse::<u32>().ok())
                        else {
                            return;
                        };

                        // Add client to list if it belongs to PID
                        if client_pid == pid {
                            clients.borrow_mut().insert(global.id, client_pid);
                        }
                    }

                    // When we find a node belonging to PID create a capture stream for it.
                    ObjectType::Node => {
                        if props.get("media.class") != Some("Stream/Output/Audio") {
                            return;
                        }
                        let Some(client_id) =
                            props.get("client.id").and_then(|id| id.parse::<u32>().ok())
                        else {
                            return;
                        };

                        // Check if client's PID is the one we need and insert node to hashset
                        if clients.borrow().get(&client_id).copied() != Some(pid) {
                            return;
                        }
                        if !nodes.borrow_mut().insert(global.id) {
                            return;
                        }

                        // Connect the stream to the node for capturing
                        let Ok((stream, listener)) =
                            connect_stream(&core, global.id, &pod_bytes, node_tx.clone())
                        else {
                            return;
                        };

                        // Keep the stream and listener alive while the node exists
                        streams
                            .borrow_mut()
                            .insert(global.id, (stream, Box::new(listener)));
                    }

                    _ => {}
                }
            }
        })
        .global_remove({
            let clients = clients.clone();
            let nodes = nodes.clone();
            let streams = streams.clone();

            move |id| {
                nodes.borrow_mut().remove(&id);
                clients.borrow_mut().remove(&id);
                streams.borrow_mut().remove(&id);
            }
        })
        .register();

    // Sync with pipewire server and get initial state
    core.sync(0)?;

    mainloop.run();

    Ok(())
}

/// Helper to create and connect a stream to a node to capture the audio and send it to tx.
fn connect_stream(
    core: &CoreRc,
    node_id: u32,
    pod_bytes: &[u8],
    node_tx: mpsc::SyncSender<Vec<f32>>,
) -> Result<(StreamRc, Box<dyn Any>), Box<dyn Error>> {
    let stream = StreamRc::new(
        core.clone(),
        "open-soundboard-audio-capturer",
        properties! {
            *keys::MEDIA_TYPE => "Audio",
            *keys::MEDIA_CATEGORY => "Capture",
            *keys::MEDIA_ROLE => "Music",
        },
    )?;

    // Register a callback for new audio data on stream
    let listener = stream
        .add_local_listener::<()>()
        .process(move |stream, _| {
            // Get raw data from buffer
            let Some(mut buf) = stream.dequeue_buffer() else {
                return;
            };
            let datas = buf.datas_mut();
            let Some(data) = datas.first_mut() else {
                return;
            };
            let chunk_offset = data.chunk().offset() as usize;
            let chunk_size = data.chunk().size() as usize;
            let Some(bytes) = data.data() else {
                return;
            };

            // Extract audio from buffer into f32 samples
            let end = (chunk_offset + chunk_size).min(bytes.len());
            let slice = &bytes[chunk_offset..end];
            let samples: Vec<f32> = slice
                .chunks_exact(4)
                .map(|b| f32::from_le_bytes([b[0], b[1], b[2], b[3]]))
                .collect();

            // Finally, send audio samples to node_tx
            if !samples.is_empty() {
                let _ = node_tx.try_send(samples);
            }
        })
        .register()
        .expect("failed to register stream listener");

    // Connect the stream to the node for capturing
    let pod = Pod::from_bytes(pod_bytes).expect("invalid pod bytes");
    stream.connect(
        Direction::Input,
        Some(node_id),
        StreamFlags::AUTOCONNECT | StreamFlags::MAP_BUFFERS,
        &mut [pod],
    )?;

    Ok((stream, Box::new(listener)))
}
