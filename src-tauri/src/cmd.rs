use serde::Serialize;
use std::sync::atomic::Ordering;
use std::sync::mpsc;
use tauri::{Emitter, State};
use tauri_plugin_autostart::ManagerExt;
use uuid::Uuid;

use crate::audio;
use crate::config;
use crate::AppState;

#[derive(Serialize)]
pub struct Progress {
    current: f64,
    total: f64,
}

#[derive(Serialize, Clone)]
pub enum AlertKind {
    Error,
    Warn,
}

#[derive(Serialize, Clone)]
pub struct Alert {
    pub kind: AlertKind,
    pub title: &'static str,
    pub message: String,
}

#[tauri::command]
pub fn play_sound(
    path: String,
    volume: Option<f32>,
    speed: Option<f32>,
    state: State<AppState>,
) -> Result<u32, String> {
    println!("Playing sound {path}");
    let device = state
        .cable_device
        .as_ref()
        .ok_or("No output device found")?
        .clone();
    let handle = audio::play_sound(&path, device, volume.unwrap_or(1.0), speed.unwrap_or(1.0))
        .map_err(|e| e.to_string())?;
    let id = state.next_id.fetch_add(1, Ordering::Relaxed);
    state.playing_sounds.lock().insert(id, handle);
    Ok(id)
}

#[tauri::command]
pub fn pause_sound(id: u32, state: State<AppState>) {
    if let Some(h) = state.playing_sounds.lock().get(&id) {
        h.pause();
    }
}

#[tauri::command]
pub fn resume_sound(id: u32, state: State<AppState>) {
    if let Some(h) = state.playing_sounds.lock().get(&id) {
        h.resume();
    }
}

#[tauri::command]
pub fn stop_sound(id: u32, state: State<AppState>) {
    if let Some(h) = state.playing_sounds.lock().get(&id) {
        h.stop();
    }
}

#[tauri::command]
pub fn seek_sound(id: u32, secs: f32, state: State<AppState>) {
    if let Some(h) = state.playing_sounds.lock().get(&id) {
        h.seek(secs);
    }
}

#[tauri::command]
pub fn set_general_volume(volume: f32, state: State<AppState>) {
    for (_, h) in state.playing_sounds.lock().iter() {
        h.set_volume(volume);
    }
}

#[tauri::command]
pub fn set_volume(id: u32, volume: f32, state: State<AppState>) {
    if let Some(h) = state.playing_sounds.lock().get(&id) {
        h.set_volume(volume);
    }
}

#[tauri::command]
pub fn set_playback_speed(id: u32, speed: f32, state: State<AppState>) {
    if let Some(h) = state.playing_sounds.lock().get(&id) {
        h.set_speed(speed);
    }
}

#[tauri::command]
pub fn stop_all_sounds(state: State<AppState>) {
    for (_, h) in state.playing_sounds.lock().drain() {
        h.stop();
    }
}

#[tauri::command]
pub fn get_progress(id: u32, state: tauri::State<AppState>) -> Option<Progress> {
    let sounds = state.playing_sounds.lock();
    let h = sounds.get(&id)?;
    Some(Progress {
        current: h.progress_secs(),
        total: h.total_secs(),
    })
}

#[tauri::command]
pub fn get_active_sounds(state: State<AppState>) -> Vec<u32> {
    state.playing_sounds.lock().keys().copied().collect()
}

#[tauri::command]
pub fn get_mic_volume(state: tauri::State<AppState>) -> f32 {
    state.mic_handle.as_ref().map_or(0.0, |h| h.volume())
}

#[tauri::command]
pub fn set_mic_volume(volume: f32, state: tauri::State<AppState>) {
    if let Some(h) = state.mic_handle.as_ref() {
        h.set_volume(volume)
    }
}

#[tauri::command]
pub fn get_mic_pitch(state: tauri::State<AppState>) -> f32 {
    state.mic_handle.as_ref().map_or(0.0, |h| h.pitch())
}

#[tauri::command]
pub fn set_mic_pitch(semitones: f32, state: State<AppState>) {
    if let Some(h) = state.mic_handle.as_ref() {
        h.set_pitch(semitones)
    }
}

#[tauri::command]
pub fn stop_mic(state: tauri::State<AppState>) {
    if let Some(h) = state.mic_handle.as_ref() {
        h.stop()
    }
}

#[tauri::command]
pub fn get_tabs(state: tauri::State<AppState>) -> Vec<(config::tab::Tab, Vec<String>)> {
    let tabs = state.cfg.lock().get_tabs();
    tabs.iter()
        .map(|t| {
            (
                t.clone(),
                t.list_sounds()
                    .into_iter()
                    .map(|p| p.to_string_lossy().to_string())
                    .collect::<Vec<_>>(),
            )
        })
        .collect()
}

#[tauri::command]
pub fn add_tab(state: tauri::State<AppState>, name: String, path: String) {
    state.cfg.lock().add_tab(name, path);
}

#[tauri::command]
pub fn remove_tab(state: tauri::State<AppState>, id: String) {
    state.cfg.lock().remove_tab(id);
}

#[tauri::command]
pub fn get_hotkeys(state: State<AppState>) -> Vec<config::hotkey::HotKeyEntry> {
    state.cfg.lock().get_hotkeys()
}

#[tauri::command]
pub fn get_custom_css(state: State<AppState>) -> Result<String, String> {
    state.cfg.lock().get_custom_css()
}

#[tauri::command]
pub fn save_custom_css(state: State<AppState>, css: String) -> Result<(), String> {
    println!("Saving custom CSS...");
    state.cfg.lock().save_custom_css(&css)
}

#[tauri::command]
pub async fn register_hotkey(
    hk: config::hotkey::HotKeyEntry,
    state: State<'_, AppState>,
) -> Result<String, String> {
    println!("Registering hotkey: {hk:?}");
    // Send register command
    let (tx, rx) = mpsc::channel();
    let tx_pipe = state.hotkey_tx.clone();
    tx_pipe
        .send(config::hotkey::HotKeyCmd::Register(hk.clone(), tx))
        .map_err(|e| format!("Worker thread communication broken: {e}"))?;

    // Receive result
    let result = rx.recv().map_err(|e| e.to_string())?;
    match result {
        Ok((returned_id, normalized_binding)) => {
            let mut normalized_hk = hk.clone();
            normalized_hk.binding = normalized_binding;
            state.cfg.lock().insert_hotkey(normalized_hk);
            Ok(returned_id.to_string())
        }
        Err(e) => Err(e),
    }
}

#[tauri::command]
pub async fn update_hotkey(
    hk: config::hotkey::HotKeyEntry,
    state: State<'_, AppState>,
) -> Result<String, String> {
    unregister_hotkey(hk.id.clone().to_string(), state.clone())
        .await
        .map_err(|e| e.to_string())?;
    register_hotkey(hk, state).await
}

#[tauri::command]
pub async fn unregister_hotkey(id: String, state: State<'_, AppState>) -> Result<(), String> {
    println!("Unregistering hotkey: {id}");
    // Send unregister command
    let parsed = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    let (tx, rx) = mpsc::channel();
    state
        .hotkey_tx
        .send(config::hotkey::HotKeyCmd::Unregister(parsed, tx))
        .map_err(|e| e.to_string())?;

    // Receive result
    rx.recv().map_err(|e| e.to_string())??;
    state.cfg.lock().remove_hotkey(parsed);
    Ok(())
}

#[tauri::command]
pub fn mark_as_ready(app: tauri::AppHandle, state: State<AppState>) -> Result<(), String> {
    let alerts: Vec<Alert> = state.pending_alerts.lock().drain(..).collect();
    for alert in alerts {
        app.emit("alert", alert).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn set_autostart(app: tauri::AppHandle, enabled: bool) -> Result<(), String> {
    println!("Setting autostart to {enabled}");
    if enabled {
        app.autolaunch().enable().map_err(|e| e.to_string())
    } else {
        app.autolaunch().disable().map_err(|e| e.to_string())
    }
}

#[tauri::command]
pub fn get_autostart(app: tauri::AppHandle) -> Result<bool, String> {
    app.autolaunch().is_enabled().map_err(|e| e.to_string())
}
