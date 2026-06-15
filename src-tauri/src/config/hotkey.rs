use crate::config;
use global_hotkey::{hotkey::HotKey, GlobalHotKeyEvent, GlobalHotKeyManager};
use serde::{Deserialize, Serialize};
use std::str::FromStr;
use std::sync::mpsc::{Receiver, Sender, TryRecvError};
use std::time::Duration;
use tauri::{AppHandle, Emitter};
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
    Register(HotKeyEntry, Sender<Result<Uuid, String>>),
    Unregister(Uuid, Sender<Result<(), String>>),
    Update(HotKeyEntry, Sender<Result<(), String>>),
}

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct HotKeyEntry {
    pub id: Uuid,
    pub binding: String,
    pub kind: HotKeyKind,
    pub context: String,
}

pub struct HotKeyState {
    manager: GlobalHotKeyManager,
}

impl HotKeyState {
    pub fn new() -> HotKeyState {
        HotKeyState {
            manager: GlobalHotKeyManager::new().unwrap(),
        }
    }

    pub fn register(&self, hk: HotKeyEntry) -> Result<HotKey, String> {
        let hotkey = HotKey::from_str(&hk.binding).map_err(|e| format!("Invalid hotkey {e}"))?;
        self.manager
            .register(hotkey.clone())
            .map_err(|e| format!("Failed to register hotkey: {e}"))?;
        Ok(hotkey)
    }

    pub fn unregister(&self, hotkey: HotKey) -> Result<(), String> {
        self.manager
            .unregister(hotkey)
            .map_err(|e| format!("Failed to unregister hotkey: {e}"))?;
        Ok(())
    }
}

impl config::Config {
    pub fn get_hotkeys(&self) -> Vec<HotKeyEntry> {
        self.hotkeys.iter().map(|(_, hk)| hk.clone()).collect()
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

    pub fn update_hotkey(&mut self, hk: HotKeyEntry) -> Result<(), String> {
        if self.hotkeys.contains_key(&hk.id) {
            self.hotkeys.insert(hk.id, hk);
            self.save();
            Ok(())
        } else {
            Err(format!("Hotkey id {} not found", hk.id))
        }
    }
}

pub fn hotkey_loop(app_handle: AppHandle, hotkey_rx: Receiver<HotKeyCmd>) {
    // Initialize state
    let hk_state = HotKeyState::new();
    let receiver = GlobalHotKeyEvent::receiver().clone();
    let mut registered: Vec<(HotKey, HotKeyEntry)> = Vec::new();

    loop {
        // Process commands
        match hotkey_rx.try_recv() {
            Ok(cmd) => match cmd {
                // Handle register command
                HotKeyCmd::Register(hk, tx) => match hk_state.register(hk.clone()) {
                    Ok(hkobj) => {
                        registered.push((hkobj, hk.clone()));
                        let _ = tx.send(Ok(hk.id));
                    }
                    Err(e) => {
                        let _ = tx.send(Err(e));
                    }
                },
                // Handle unregister command
                HotKeyCmd::Unregister(id, tx) => {
                    if let Some(pos) = registered.iter().position(|(_, entry)| entry.id == id) {
                        let (hkobj, _) = registered.remove(pos);
                        let res = hk_state.unregister(hkobj);
                        let _ = tx.send(res);
                    } else {
                        let _ = tx.send(Err(format!("Hotkey id {} not found", id)));
                    }
                }
                // Handle update command
                HotKeyCmd::Update(hk, tx) => {
                    if let Some(pos) = registered.iter().position(|(_, entry)| entry.id == hk.id) {
                        // Remove old hotkey
                        let (hkobj, _) = registered.remove(pos);
                        let unregister_res = hk_state.unregister(hkobj);
                        if let Err(e) = unregister_res {
                            let _ = tx.send(Err(e));
                            continue;
                        }

                        // Register new hotkey
                        match hk_state.register(hk.clone()) {
                            Ok(newhkobj) => {
                                registered.push((newhkobj, hk.clone()));
                                let _ = tx.send(Ok(()));
                            }
                            Err(e) => {
                                let _ = tx.send(Err(e));
                            }
                        }
                    } else {
                        let _ = tx.send(Err(format!("Hotkey id {} not found", hk.id)));
                    }
                }
            },
            Err(TryRecvError::Empty) => {}
            Err(TryRecvError::Disconnected) => break,
        }

        // Process hotkey events
        match receiver.recv_timeout(Duration::from_millis(100)) {
            Ok(event) => {
                if let Some((_, hk)) = registered.iter().find(|(h, _)| h.id() == event.id) {
                    let _ = app_handle.emit("hotkey-pressed", hk.clone());
                }
            }
            Err(_) => {}
        }
    }
}
