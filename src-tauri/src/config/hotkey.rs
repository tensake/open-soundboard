//! Logic related to registering and unregistering hotkeys.

use crate::config;
use serde::{Deserialize, Serialize};
use std::str::FromStr;
use std::sync::mpsc::{Receiver, Sender, TryRecvError};
use std::time::Duration;
use tauri::Manager;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut};
use uuid::Uuid;

/// Hotkey kind
#[derive(Serialize, Deserialize, Debug, Clone)]
pub enum HotKeyKind {
    /// For playing a sound
    Sound,
    /// For controling playback and microphone (global only)
    Control,
}

pub enum HotKeyCmd {
    Register(HotKeyEntry, Sender<Result<(Uuid, String), String>>),
    Unregister(Uuid, Sender<Result<(), String>>),
}

/// Represents a hotkey entry.
#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct HotKeyEntry {
    pub id: Uuid,
    pub binding: String,
    pub kind: HotKeyKind,
    pub context: String,
}

/// Listens for hotkey commands and handles them on the main thread.
pub fn listen_hotkeys(app_handle: tauri::AppHandle, hotkey_rx: Receiver<HotKeyCmd>) {
    loop {
        match hotkey_rx.try_recv() {
            Ok(cmd) => match cmd {
                HotKeyCmd::Register(hk, tx) => {
                    let app = app_handle.clone();
                    let binding = hk.binding;

                    let _ =
                        app_handle.run_on_main_thread(move || match Shortcut::from_str(&binding) {
                            Ok(shortcut) => {
                                let normalized = shortcut.to_string();
                                let res = app
                                    .global_shortcut()
                                    .register(shortcut)
                                    .map(|_| (hk.id, normalized))
                                    .map_err(|e| format!("Hotkey registration failed: {e}"));

                                let _ = tx.send(res);
                            }
                            Err(e) => {
                                let _ = tx.send(Err(format!("Invalid hotkey string: {e}")));
                            }
                        });
                }

                HotKeyCmd::Unregister(id, tx) => {
                    let app = app_handle.clone();
                    let state = app.state::<crate::AppState>();

                    // Find registered hotkey by id
                    let active_hotkeys = state.cfg.lock().get_hotkeys();
                    if let Some(hk) = active_hotkeys.iter().find(|h| h.id == id) {
                        let binding = hk.binding.clone();

                        let _ = app_handle.run_on_main_thread(move || {
                            if let Ok(shortcut) = Shortcut::from_str(&binding) {
                                let res = app
                                    .global_shortcut()
                                    .unregister(shortcut)
                                    .map_err(|e| format!("Hotkey unregistration failed: {e}"));

                                let _ = tx.send(res);
                            } else {
                                let _ =
                                    tx.send(Err("Stored shortcut syntax is invalid".to_string()));
                            }
                        });
                    } else {
                        let _ = tx.send(Err(format!("Hotkey with id {id} not found")));
                    }
                }
            },
            Err(TryRecvError::Empty) => {
                std::thread::sleep(Duration::from_millis(50));
            }
            Err(TryRecvError::Disconnected) => break,
        }
    }
}

impl config::Config {
    pub fn get_hotkeys(&self) -> Vec<HotKeyEntry> {
        self.hotkeys.values().cloned().collect()
    }

    pub fn insert_hotkey(&mut self, hk: HotKeyEntry) {
        self.hotkeys.insert(hk.id, hk);
        self.save();
    }

    pub fn remove_hotkey(&mut self, id: Uuid) -> Option<HotKeyEntry> {
        let removed = self.hotkeys.remove(&id);
        if removed.is_some() {
            self.save();
        }
        removed
    }
}
