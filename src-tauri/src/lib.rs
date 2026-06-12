use parking_lot::Mutex;
use std::collections::HashMap;
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Arc;
use tauri::State;

mod audio;

struct AppState {
    cable_device: Arc<cpal::Device>,
    playing_sounds: Arc<Mutex<HashMap<u32, audio::PlaybackHandle>>>,
    next_id: AtomicU32,
}

#[derive(serde::Serialize)]
struct Progress {
    current: f64,
    total: f64,
}

#[tauri::command]
fn play_sound(path: String, volume: Option<f32>, state: State<AppState>) -> Result<u32, String> {
    let device = state.cable_device.clone();
    let handle =
        audio::play_sound(&path, device, volume.unwrap_or(1.0)).map_err(|e| e.to_string())?;
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
fn set_general_volume(volume: f32, state: State<AppState>) {
    for (_, h) in state.playing_sounds.lock().iter() {
        h.set_volume(volume);
    }
}

#[tauri::command]
fn set_volume(id: u32, volume: f32, state: State<AppState>) {
    if let Some(h) = state.playing_sounds.lock().get(&id) {
        h.set_volume(volume);
    }
}

#[tauri::command]
fn stop_all_sounds(state: State<AppState>) {
    for (_, h) in state.playing_sounds.lock().drain() {
        h.stop();
    }
}

#[tauri::command]
fn get_progress(id: u32, state: tauri::State<AppState>) -> Option<Progress> {
    let sounds = state.playing_sounds.lock();
    let h = sounds.get(&id)?;
    Some(Progress {
        current: h.progress_secs(),
        total: h.total_secs(),
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let playing_sounds = Arc::new(Mutex::new(HashMap::<u32, audio::PlaybackHandle>::new()));

    // Sound cleanup thread
    let playing_sounds_cleanup = playing_sounds.clone();
    std::thread::spawn(move || loop {
        std::thread::sleep(std::time::Duration::from_secs(1));
        playing_sounds_cleanup.lock().retain(|_, h| !h.is_done());
    });

    tauri::Builder::default()
        .manage(AppState {
            cable_device: Arc::new(audio::device::get_cable()),
            playing_sounds,
            next_id: AtomicU32::new(0),
        })
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            play_sound,
            pause_sound,
            resume_sound,
            stop_sound,
            set_general_volume,
            set_volume,
            stop_all_sounds,
            get_progress
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
