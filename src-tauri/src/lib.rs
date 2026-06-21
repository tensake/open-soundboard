use parking_lot::Mutex;
use std::collections::HashMap;
use std::sync::atomic::AtomicU32;
use std::sync::mpsc;
use std::sync::Arc;
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
};
use tauri::{Emitter, Manager};

mod audio;
mod cmd;
mod config;

struct AppState {
    cable_device: Option<Arc<cpal::Device>>,
    playing_sounds: Arc<Mutex<HashMap<u32, audio::PlaybackHandle>>>,
    forwarding_handles: Arc<Mutex<HashMap<u32, audio::forwarding::ForwardingHandle>>>,
    next_id: AtomicU32,
    mic_handle: Option<audio::mic::MicrophoneHandle>,
    cfg: Mutex<config::Config>,
    hotkey_tx: mpsc::Sender<config::hotkey::HotKeyCmd>,

    /// Alerts that are stored before frontend is ready to receive them
    pending_alerts: Mutex<Vec<cmd::Alert>>,
}

fn hide_window(app: &tauri::AppHandle, label: &str) {
    println!("Hiding {label} window");
    if let Some(window) = app.get_webview_window(label) {
        let _ = window.hide();
    }
}

fn show_window(app: &tauri::AppHandle, label: &str) {
    println!("Showing {label} window");
    if let Some(window) = app.get_webview_window(label) {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

fn setup_tray(app: &tauri::AppHandle) -> tauri::Result<()> {
    // Setup tray menu
    let show = MenuItem::with_id(app, "show", "Show", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit Open Soundboard", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &quit])?;

    // Build tray
    TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .tooltip("Open Soundboard")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => {
                show_window(app, "main");
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let tauri::tray::TrayIconEvent::Click { button, .. } = event {
                if button == tauri::tray::MouseButton::Left {
                    show_window(tray.app_handle(), "main");
                }
            }
        })
        .build(app)?;

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            show_window(app, "main");
        }))
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--hidden"]),
        ))
        .setup(move |app| {
            // Initialize state
            let playing_sounds = Arc::new(Mutex::new(HashMap::<u32, audio::PlaybackHandle>::new()));
            let forwarding_handles = Arc::new(Mutex::new(HashMap::<u32, audio::forwarding::ForwardingHandle>::new()));
            let mut pending_alerts = Vec::new();

            // Get audio devices
            let input_device = audio::device::get_input_device()
                .map_err(|e| {
                    pending_alerts.push(cmd::Alert {
                        kind: cmd::AlertKind::Error,
                        title: "Input device error",
                        message: e,
                    });
                })
                .ok()
                .map(Arc::new);
            let cable_device = audio::device::get_cable()
                .map_err(|e| {
                    pending_alerts.push(cmd::Alert {
                        kind: cmd::AlertKind::Error,
                        title: "Output device error",
                        message: e,
                    })
                })
                .ok()
                .map(Arc::new);

            // Sound cleanup thread
            let playing_sounds_cleanup = playing_sounds.clone();
            std::thread::spawn(move || loop {
                std::thread::sleep(std::time::Duration::from_secs(1));
                playing_sounds_cleanup.lock().retain(|_, h| !h.is_done());
            });

            // Start microphone forwarding
            let mic_handle = match (&input_device, &cable_device) {
                (Some(input), Some(cable)) => {
                    audio::mic::start_forwarding(input.clone(), cable.clone())
                        .map_err(|e| {
                            pending_alerts.push(cmd::Alert {
                                kind: cmd::AlertKind::Warn,
                                title: "Microphone forwarding error",
                                message: e.to_string(),
                            });
                        })
                        .ok()
                }
                _ => None,
            };

            // Load config
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
                forwarding_handles: forwarding_handles,
                next_id: AtomicU32::new(0),
                mic_handle,
                cfg: Mutex::new(cfg),
                hotkey_tx,
                pending_alerts: Mutex::new(pending_alerts),
            };
            app.manage(app_state);

            // Setup tray
            setup_tray(app.handle())?;

            // Handle cli arguments
            if std::env::args().any(|a| a == "--hidden") {
                hide_window(app.handle(), "main");
            }

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
                                println!(
                                    "Hotkey {0} pressed! Context: {1}",
                                    hk.binding, hk.context
                                );
                                let _ = app.emit("hotkey-pressed", hk.clone());
                            }
                        }
                    }
                })
                .build(),
        )
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                hide_window(window.app_handle(), "main");
                api.prevent_close();
            }
        })
        .invoke_handler(tauri::generate_handler![
            // Sound
            cmd::play_sound,
            cmd::pause_sound,
            cmd::resume_sound,
            cmd::stop_sound,
            cmd::seek_sound,
            cmd::set_general_volume,
            cmd::set_volume,
            cmd::stop_all_sounds,
            cmd::get_progress,
            cmd::get_active_sounds,
            cmd::set_playback_speed,
            // Microphone
            cmd::get_mic_volume,
            cmd::set_mic_volume,
            cmd::get_mic_pitch,
            cmd::set_mic_pitch,
            cmd::stop_mic,
            // App forwarding
            cmd::get_audio_apps,
            // Config
            cmd::get_tabs,
            cmd::add_tab,
            cmd::remove_tab,
            cmd::get_custom_css,
            cmd::save_custom_css,
            // Hotkeys
            cmd::get_hotkeys,
            cmd::register_hotkey,
            cmd::update_hotkey,
            cmd::unregister_hotkey,
            // Initialization
            cmd::mark_as_ready,
            // Autostart
            cmd::set_autostart,
            cmd::get_autostart,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
