use parking_lot::Mutex;
use std::collections::HashMap;
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::mpsc;
use std::sync::Arc;
use tauri::{Emitter, Manager, State};
use uuid::Uuid;

mod audio;
mod config;

struct AppState {
    cable_device: Arc<cpal::Device>,
    playing_sounds: Arc<Mutex<HashMap<u32, audio::PlaybackHandle>>>,
    next_id: AtomicU32,
    mic_handle: audio::mic::MicrophoneHandle,
    cfg: Mutex<config::Config>,
    hotkey_tx: mpsc::Sender<config::hotkey::HotKeyCmd>,
}

#[derive(serde::Serialize)]
struct Progress {
    current: f64,
    total: f64,
}

#[tauri::command]
fn play_sound(path: String, volume: Option<f32>, state: State<AppState>) -> Result<u32, String> {
    println!("Playing sound {path}");
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
fn seek_sound(id: u32, secs: f32, state: State<AppState>) {
    if let Some(h) = state.playing_sounds.lock().get(&id) {
        h.seek(secs);
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

#[tauri::command]
fn get_active_sounds(state: State<AppState>) -> Vec<u32> {
    state.playing_sounds.lock().keys().copied().collect()
}

#[tauri::command]
fn get_mic_volume(state: tauri::State<AppState>) -> f32 {
    state.mic_handle.volume()
}

#[tauri::command]
fn set_mic_volume(volume: f32, state: tauri::State<AppState>) {
    state.mic_handle.set_volume(volume);
}

#[tauri::command]
fn stop_mic(state: tauri::State<AppState>) {
    state.mic_handle.stop();
}

#[tauri::command]
fn get_tabs(state: tauri::State<AppState>) -> Vec<(config::tab::Tab, Vec<String>)> {
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
fn add_tab(state: tauri::State<AppState>, name: String, path: String) {
    state.cfg.lock().add_tab(name, path);
}

#[tauri::command]
fn remove_tab(state: tauri::State<AppState>, id: String) {
    state.cfg.lock().remove_tab(id);
}

#[tauri::command]
fn get_hotkeys(state: State<AppState>) -> Vec<config::hotkey::HotKeyEntry> {
    state.cfg.lock().get_hotkeys()
}

#[tauri::command]
async fn register_hotkey(
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
async fn update_hotkey(hk: config::hotkey::HotKeyEntry, state: State<'_, AppState>) -> Result<(), String> {
    println!("Updating hotkey: {hk:?}");
    // Send update command
    let (tx, rx) = mpsc::channel();
    state
        .hotkey_tx
        .send(config::hotkey::HotKeyCmd::Update(hk.clone(), tx))
        .map_err(|e| e.to_string())?;

    // Receive result
    let normalized_binding = rx.recv().map_err(|e| e.to_string())??;
    let mut normalized_hk = hk.clone();
    normalized_hk.binding = normalized_binding;
    state.cfg.lock().update_hotkey(normalized_hk)
}

#[tauri::command]
async fn unregister_hotkey(id: String, state: State<'_, AppState>) -> Result<(), String> {
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let playing_sounds = Arc::new(Mutex::new(HashMap::<u32, audio::PlaybackHandle>::new()));
    let input_device = Arc::new(audio::device::get_input_device());
    let cable_device = Arc::new(audio::device::get_cable());

    // Sound cleanup thread
    let playing_sounds_cleanup = playing_sounds.clone();
    std::thread::spawn(move || loop {
        std::thread::sleep(std::time::Duration::from_secs(1));
        playing_sounds_cleanup.lock().retain(|_, h| !h.is_done());
    });

    // Start microphone forwarding
    let mic_handle = audio::mic::start_forwarding(input_device, cable_device.clone())
        .expect("Failed to start microphone forwarding");

    tauri::Builder::default()
        .setup(move |app| {
            let cfg = config::Config::new(
                app.path()
                    .app_data_dir()
                    .expect("Failed to get app data directory"),
            );

            // Spawn thread for processing hotkey commands
            let (hotkey_tx, hotkey_rx) = mpsc::channel::<config::hotkey::HotKeyCmd>();
            let app_handle = app.handle().clone();
            std::thread::spawn(move || config::hotkey::listen_hotkeys(app_handle, hotkey_rx));

            // Create app state
            let app_state = AppState {
                cable_device: cable_device.clone(),
                playing_sounds: playing_sounds.clone(),
                next_id: AtomicU32::new(0),
                mic_handle,
                cfg: Mutex::new(cfg),
                hotkey_tx,
            };
            app.manage(app_state);

            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            // https://v2.tauri.app/plugin/global-shortcut/
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(move |app, shortcut, event| {
                    if event.state() == tauri_plugin_global_shortcut::ShortcutState::Pressed {
                        if let Some(state) = app.try_state::<AppState>() {
                            if let Some(hk) = state
                                .cfg
                                .lock()
                                .get_hotkeys()
                                .iter()
                                .find(|h| h.binding == shortcut.to_string())
                            {
                                println!("Hotkey {0} pressed! Context: {1}", hk.binding, hk.context);
                                let _ = app.emit("hotkey-pressed", hk.clone());
                            }
                        }
                    }
                })
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            // Sound
            play_sound,
            pause_sound,
            resume_sound,
            stop_sound,
            seek_sound,
            set_general_volume,
            set_volume,
            stop_all_sounds,
            get_progress,
            get_active_sounds,
            // Microphone
            get_mic_volume,
            set_mic_volume,
            stop_mic,
            // Config
            get_tabs,
            add_tab,
            remove_tab,
            // Hotkeys
            get_hotkeys,
            register_hotkey,
            update_hotkey,
            unregister_hotkey,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
