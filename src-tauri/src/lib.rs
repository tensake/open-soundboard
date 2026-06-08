use std::sync::Arc;
use tauri::State;

mod audio;

struct AppState {
    cable_device: Arc<cpal::Device>,
}

#[tauri::command]
fn play_sound(path: String, state: State<AppState>) {
    let device = state.cable_device.clone();
    std::thread::spawn(move || {
        if let Err(e) = audio::play_mp3(&path, device) {
            eprintln!("Playback error: {e}");
        }
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState {
            cable_device: Arc::new(audio::get_cable_device()),
        })
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![play_sound])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
