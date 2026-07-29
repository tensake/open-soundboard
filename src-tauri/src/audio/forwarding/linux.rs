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
