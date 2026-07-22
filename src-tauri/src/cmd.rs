//! Commands for interacting with the Tauri application for frontend.

use serde::Serialize;
use std::sync::Arc;
use std::sync::atomic::AtomicU32;
use std::sync::atomic::Ordering;
use std::sync::mpsc;
use tauri::{Manager, State};
use tauri_plugin_autostart::ManagerExt;
use uuid::Uuid;

use crate::AppState;
use crate::audio;
use crate::config;

#[derive(Serialize)]
pub struct Progress {
    current: f64,
    total: f64,
}

#[derive(Serialize, Clone)]
pub enum AlertKind {
    Error,
    #[allow(unused)]
    Warn,
}

#[derive(Serialize, Clone)]
pub struct Alert {
    pub kind: AlertKind,
    pub title: String,
    pub message: String,
}

#[tauri::command]
pub fn play_sound(
    path: String,
    volume: Option<f32>,
    speed: Option<f32>,
    state: State<AppState>,
    app_handle: tauri::AppHandle,
) -> Result<u32, String> {
    let cable_device = state
        .cable_device
        .lock()
        .as_ref()
        .ok_or("No cable device found")?
        .clone();
    let output_device = state
        .output_device
        .lock()
        .as_ref()
        .ok_or("No output device found")?
        .clone();
    let normalize = state.cfg.lock().normalize();
    let file_key = state.cache.get_file_key(&path).ok();
    log::info!("Playing sound {path} and using key {file_key:?}");

    // Try to get normalization gain from cache
    let cached_gain: Option<f32> = file_key
        .as_deref()
        .and_then(|key| state.cache.get_normalization_cache(key).ok().flatten());
    let initial_gain = if normalize {
        cached_gain.unwrap_or(1.0)
    } else {
        1.0
    };
    let normalization_gain: Arc<AtomicU32> = Arc::new(AtomicU32::new(initial_gain.to_bits()));

    let handle = audio::play_sound(
        &path,
        cable_device,
        output_device,
        volume.unwrap_or(1.0),
        speed.unwrap_or(1.0),
        normalize,
        normalization_gain.clone(),
    )
    .map_err(|e| e.to_string())?;

    let id = state.next_id.fetch_add(1, Ordering::Relaxed);
    state.playing_sounds.lock().insert(id, handle);

    // Spawn a thread to calculate normalization gain if needed
    if cached_gain.is_none() {
        std::thread::spawn(move || {
            let state = app_handle.state::<AppState>();
            let file_key = match state.cache.get_file_key(&path) {
                Ok(k) => k,
                Err(e) => {
                    log::error!("Failed to get file key for {path}: {e}");
                    return;
                }
            };
            match audio::normalize::calculate_gain(&path) {
                Ok(gain) => {
                    log::debug!("Calculated normalization gain for {path}: {gain}");
                    normalization_gain.store(gain.to_bits(), Ordering::Relaxed);
                    if let Err(e) = state.cache.set_normalization_cache(&file_key, gain) {
                        log::error!("Failed to save normalization cache: {e}");
                    }
                }
                Err(e) => log::error!("Normalization gain calculation failed: {e}"),
            }
        });
    }

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
pub fn get_audio_apps() -> Result<Vec<audio::forwarding::AudioApp>, String> {
    audio::forwarding::get_audio_apps().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn forward_app(pid: u32, state: tauri::State<AppState>) -> Result<u32, String> {
    log::info!("Starting forwarder for app: {pid}");
    let cable = state
        .cable_device
        .lock()
        .clone()
        .ok_or("No cable device available")?;
    let volume = Arc::new(AtomicU32::new(1.0f32.to_bits()));

    let handle = audio::forwarding::forward_app(pid, cable, volume).map_err(|e| e.to_string())?;
    let id = state
        .next_id
        .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    state.forwarding_handles.lock().insert(id, handle);
    Ok(id)
}

#[tauri::command]
pub fn stop_forward(id: u32, state: tauri::State<AppState>) -> Result<(), String> {
    log::info!("Stopping forwarder with id: {id}");
    if let Some(handle) = state.forwarding_handles.lock().remove(&id) {
        handle.stop();
    }
    Ok(())
}

#[tauri::command]
pub fn set_forward_volume(
    id: u32,
    volume: f32,
    state: tauri::State<AppState>,
) -> Result<(), String> {
    if let Some(handle) = state.forwarding_handles.lock().get(&id) {
        handle.set_volume(volume);
    }
    Ok(())
}

#[tauri::command]
pub fn get_mic_volume(state: tauri::State<AppState>) -> f32 {
    state.mic_handle.lock().as_ref().map_or(0.0, |h| h.volume())
}

#[tauri::command]
pub fn set_mic_volume(volume: f32, state: tauri::State<AppState>) {
    if let Some(h) = state.mic_handle.lock().as_ref() {
        h.set_volume(volume)
    }
}

#[tauri::command]
pub fn get_mic_pitch(state: tauri::State<AppState>) -> f32 {
    state.mic_handle.lock().as_ref().map_or(0.0, |h| h.pitch())
}

#[tauri::command]
pub fn set_mic_pitch(semitones: f32, state: State<AppState>) {
    if let Some(h) = state.mic_handle.lock().as_ref() {
        h.set_pitch(semitones)
    }
}

#[tauri::command]
pub fn stop_mic(state: tauri::State<AppState>) {
    if let Some(h) = state.mic_handle.lock().as_ref() {
        h.stop()
    }
}

#[tauri::command]
pub fn get_tabs(
    state: tauri::State<AppState>,
) -> Vec<(config::tab::Tab, Vec<config::tab::SoundFile>)> {
    let tabs = state.cfg.lock().get_tabs();
    tabs.iter().map(|t| (t.clone(), t.list_sounds())).collect()
}

#[tauri::command]
pub fn add_tab(state: tauri::State<AppState>, name: String, path: String) {
    log::info!("Adding tab: {path}");
    state.cfg.lock().add_tab(name, path);
}

#[tauri::command]
pub fn remove_tab(state: tauri::State<AppState>, id: String) {
    log::info!("Removing tab: {id}");
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
    log::info!("Saving custom CSS...");
    state.cfg.lock().save_custom_css(&css)
}

#[tauri::command]
pub async fn register_hotkey(
    hk: config::hotkey::HotKeyEntry,
    state: State<'_, AppState>,
) -> Result<String, String> {
    log::info!("Registering hotkey: {hk:?}");
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
    log::info!("Unregistering hotkey: {id}");
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
pub fn mark_as_ready() -> Result<(), String> {
    // Will be used later
    Ok(())
}

#[tauri::command]
pub fn onboard(state: State<AppState>) -> Result<(), String> {
    let mut cfg = state.cfg.lock();
    cfg.onboard();
    Ok(())
}

#[tauri::command]
pub fn is_onboarded(state: State<AppState>) -> bool {
    state.cfg.lock().onboarded()
}

#[tauri::command]
pub fn get_normalize(state: State<AppState>) -> bool {
    state.cfg.lock().normalize()
}

#[tauri::command]
pub fn set_normalize(state: State<AppState>, normalize: bool) -> Result<(), String> {
    log::info!("Setting normalization to {normalize}");
    let mut cfg = state.cfg.lock();
    cfg.set_normalize(normalize);

    for (_, h) in state.playing_sounds.lock().iter() {
        h.set_normalize(normalize);
    }

    Ok(())
}

#[tauri::command]
pub fn set_autostart(app: tauri::AppHandle, enabled: bool) -> Result<(), String> {
    log::info!("Setting autostart to {enabled}");
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

#[tauri::command]
pub fn clear_all_cache(state: State<AppState>) -> Result<(), String> {
    log::info!("Clearing all cache...");
    state.cache.clear_all_cache().map_err(|e| e.to_string())
}
