use parking_lot::Mutex;
use std::collections::HashMap;
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Arc;
use tauri::State;

mod audio;

struct AppState {
    cable_device: Arc<cpal::Device>,
    playing_sounds: Mutex<HashMap<u32, audio::PlaybackHandle>>,
    next_id: AtomicU32,
}

#[tauri::command]
fn play_sound(path: String, state: State<AppState>) -> Result<u32, String> {
    let device = state.cable_device.clone();
    let handle = audio::play_mp3(&path, device).map_err(|e| e.to_string())?;
    let id = state.next_id.fetch_add(1, Ordering::Relaxed);
    state.playing_sounds.lock().insert(id, handle);
    Ok(id)
}

#[tauri::command]
fn pause_sound(id: u32, state: State<AppState>) {
    if let Some(h) = state.playing_sounds.lock().get(&id) {
        h.pause();
    }
}

#[tauri::command]
fn resume_sound(id: u32, state: State<AppState>) {
    if let Some(h) = state.playing_sounds.lock().get(&id) {
        h.resume();
    }
}

#[tauri::command]
fn stop_sound(id: u32, state: State<AppState>) {
    if let Some(h) = state.playing_sounds.lock().get(&id) {
        h.stop();
    }
}

#[tauri::command]
fn stop_all_sounds(state: State<AppState>) {
    for (_, h) in state.playing_sounds.lock().drain() {
        h.stop();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState {
            cable_device: Arc::new(audio::get_cable_device()),
            playing_sounds: Mutex::new(HashMap::new()),
            next_id: AtomicU32::new(0),
        })
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            play_sound,
            pause_sound,
            resume_sound,
            stop_sound,
            stop_all_sounds
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
