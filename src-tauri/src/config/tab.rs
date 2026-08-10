//! Configuration for tabs in the dashboard.

use crate::cache::CacheDb;
use crate::config;
use mp3_duration;
use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

const ALLOWED_FILE_EXT: [&str; 8] = [
    "mp3", "wav", "flac", "vorbis", "ogg", "isomp4", "aac", "pcm",
];

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum TabKind {
    Directory,
    User,
    Favourite,
}

/// Represents a tab in the dashboard tab.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct Tab {
    id: String,
    kind: TabKind,
    name: String,
    path: Option<String>,
    sounds: Vec<String>,
}

/// Represents a sound file in a tab.
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SoundFile {
    path: String,
    size: u64,
    datetime: u64,
    duration: u64,
}

fn get_duration(cache: &CacheDb, path: &PathBuf) -> u64 {
    let hash = crate::cache::get_file_key(&path.to_string_lossy()).unwrap_or_default();

    // Check cache first
    if let Ok(Some(duration)) = cache.get_duration(&hash) {
        return duration;
    }

    let duration = mp3_duration::from_path(path)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);
    let _ = cache.set_duration(&hash, duration);
    duration
}

fn get_sound_file(p: &PathBuf, cache: &CacheDb) -> SoundFile {
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
        duration: get_duration(cache, p),
    }
}

impl Tab {
    /// Lists all sounds in the tab's path that are sound files.
    pub fn list_sounds(&self, cache: &CacheDb) -> Vec<SoundFile> {
        match self.kind {
            TabKind::Directory => {
                let Some(path) = &self.path else {
                    return vec![];
                };
                let paths: Vec<PathBuf> = config::list_path(PathBuf::from(path))
                    .unwrap_or_default()
                    .into_iter()
                    .filter(|p| {
                        p.extension()
                            .and_then(|e| e.to_str())
                            .map(|e| ALLOWED_FILE_EXT.contains(&e.to_lowercase().as_str()))
                            .unwrap_or(false)
                    })
                    .collect();
                paths.par_iter().map(|p| get_sound_file(p, cache)).collect()
            }
            TabKind::User => self
                .sounds
                .par_iter()
                .map(|s| get_sound_file(&PathBuf::from(s), cache))
                .collect(),
            _ => vec![],
        }
    }
}

impl config::Config {
    pub fn add_tab(&mut self, name: String, kind: TabKind, path: Option<String>) {
        let tab = Tab {
            id: uuid::Uuid::new_v4().to_string(),
            name,
            kind,
            path,
            sounds: Vec::new(),
        };
        self.tabs.push(tab);
    }

    pub fn remove_tab(&mut self, id: String) {
        self.tabs.retain(|t| t.id != id);
    }

    pub fn get_tabs(&self) -> Vec<Tab> {
        self.tabs.clone()
    }

    pub fn get_tab(&self, id: String) -> Option<Tab> {
        self.tabs.iter().find(|t| t.id == id).cloned()
    }

    pub fn edit_tab(&mut self, tab: Tab) {
        if let Some(index) = self.tabs.iter().position(|t| t.id == tab.id) {
            self.tabs[index] = tab;
        }
    }

    pub fn move_tab(&mut self, id: String, idx: usize) {
        if let Some(index) = self.tabs.iter().position(|t| t.id == id) {
            let tab = self.tabs.remove(index);
            self.tabs.insert(idx, tab);
        }
    }
}
