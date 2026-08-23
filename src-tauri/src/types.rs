//! Types used in the application.

use serde::{Deserialize, Serialize};
use specta::Type;
use tauri_specta::Event;
use uuid::Uuid;

/// Representation of an audio app for forwarding.
#[derive(Serialize, Clone, Type)]
pub struct AudioApp {
    pub id: u32,
    pub name: String,
    /// Base64 encoded icon
    pub icon: Option<String>,
}

/// Kind of the [`Tab`].
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Type)]
#[serde(rename_all = "snake_case")]
pub enum TabKind {
    Directory,
    User,
    Favourite,
}

/// Represents a tab in the dashboard tab.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Type)]
pub struct Tab {
    pub id: String,
    pub kind: TabKind,
    pub name: String,
    pub path: Option<String>,
    pub sounds: Vec<String>,
}

/// Represents a sound file in a tab.
#[derive(Serialize, Deserialize, Debug, Clone, Type)]
pub struct SoundFile {
    pub path: String,
    pub size: u64,
    pub datetime: u64,
    pub duration: u64,
}

/// Hotkey kind
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Type)]
pub enum HotKeyKind {
    /// For playing a sound
    Sound,
    /// For controling playback and microphone (global only)
    Control,
}

/// Represents a hotkey entry.
#[derive(Clone, Serialize, Deserialize, Debug, PartialEq, Type)]
pub struct HotKeyEntry {
    pub id: Uuid,
    pub binding: String,
    pub kind: HotKeyKind,
    pub context: String,
}

/// Representation of the customisation for the sound, use path as key.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Type)]
pub struct SoundConfig {
    /// Tags associated with the sound.
    pub tags: Vec<String>,
    /// List of tabs that the sound is pinned to.
    pub pins: Vec<String>,
}

/// Progress of a sound.
#[derive(Serialize, Type)]
pub struct Progress {
    pub current: f64,
    pub total: f64,
}

/// Kind of the [`Alert`].
#[derive(Serialize, Clone, Type)]
pub enum AlertKind {
    Error,
    #[allow(unused)]
    Warn,
}

/// Represents an alert to be displayed in the UI.
#[derive(Serialize, Clone, Type)]
pub struct Alert {
    pub kind: AlertKind,
    pub title: String,
    pub message: String,
}

/// Event emitted when an alert is displayed.
#[derive(Debug, Clone, Serialize, Deserialize, Type, Event)]
pub struct AlertEvent {
    pub title: String,
    pub message: String,
}

/// Event emitted when an alert is dismissed.
#[derive(Debug, Clone, Serialize, Deserialize, Type, Event)]
pub struct AlertDismissEvent(pub String);
