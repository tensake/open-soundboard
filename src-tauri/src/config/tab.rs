//! Configuration for tabs in the dashboard.

use crate::config;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

const ALLOWED_FILE_EXT: [&str; 8] = [
    "mp3", "wav", "flac", "vorbis", "ogg", "isomp4", "aac", "pcm",
];

/// Represents a tab in the dashboard tab.
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Tab {
    id: String,
    name: String,
    path: String,
}

/// Represents a sound file in a tab.
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SoundFile {
    path: String,
    size: u64,
    datetime: u64,
}

impl Tab {
    /// Lists all sounds in the tab's path that are sound files.
    pub fn list_sounds(&self) -> Vec<SoundFile> {
        config::list_path(PathBuf::from(&self.path))
            .unwrap_or_default()
            .into_iter()
            .filter(|p| {
                p.extension()
                    .and_then(|e| e.to_str())
                    .map(|e| ALLOWED_FILE_EXT.contains(&e.to_lowercase().as_str()))
                    .unwrap_or(false)
            })
            .map(|p| {
                let meta = p.metadata().ok();
                SoundFile {
                    path: p.to_string_lossy().into_owned(),
                    size: meta.as_ref().map(|m| m.len()).unwrap_or(0),
                    datetime: meta
                        .as_ref()
                        .and_then(|m| m.modified().ok())
                        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                        .map(|d| d.as_secs())
                        .unwrap_or(0),
                }
            })
            .collect()
    }
}

impl config::Config {
    pub fn add_tab(&mut self, name: String, path: String) {
        let tab = Tab {
            id: uuid::Uuid::new_v4().to_string(),
            name,
            path,
        };
        self.tabs.push(tab);
        self.save();
    }

    pub fn remove_tab(&mut self, id: String) {
        self.tabs.retain(|t| t.id != id);
        self.save();
    }

    pub fn get_tabs(&self) -> Vec<Tab> {
        self.tabs.clone()
    }

    pub fn move_tab(&mut self, id: String, idx: usize) {
        if let Some(index) = self.tabs.iter().position(|t| t.id == id) {
            let tab = self.tabs.remove(index);
            self.tabs.insert(idx, tab);
            self.save();
        }
    }
}
