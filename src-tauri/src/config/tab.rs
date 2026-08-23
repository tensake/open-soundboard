//! Configuration for tabs in the dashboard.

use crate::cache::CacheDb;
use crate::config;
use crate::types;
use mp3_duration;
use rayon::prelude::*;
use std::path::PathBuf;

const ALLOWED_FILE_EXT: [&str; 8] = [
    "mp3", "wav", "flac", "vorbis", "ogg", "isomp4", "aac", "pcm",
];

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

fn get_sound_file(p: &PathBuf, cache: &CacheDb) -> types::SoundFile {
    let meta = p.metadata().ok();
    types::SoundFile {
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

impl config::Config {
    /// Lists all sounds in the tab by its ID.
    pub fn list_tab_sounds(&self, tab_id: &str, cache: &CacheDb) -> Vec<types::SoundFile> {
        let Some(tab) = self.tabs.iter().find(|t| t.id == tab_id) else {
            return vec![];
        };

        match tab.kind {
            types::TabKind::Directory => {
                let Some(path) = &tab.path else {
                    return vec![];
                };
                let paths: Vec<PathBuf> = config::list_path(PathBuf::from(path))
                    .unwrap_or_default()
                    .par_iter()
                    .filter(|p| {
                        p.extension()
                            .and_then(|e| e.to_str())
                            .map(|e| ALLOWED_FILE_EXT.contains(&e.to_lowercase().as_str()))
                            .unwrap_or(false)
                    })
                    .cloned()
                    .collect();
                paths.par_iter().map(|p| get_sound_file(p, cache)).collect()
            }
            types::TabKind::User => tab
                .sounds
                .par_iter()
                .map(|s| get_sound_file(&PathBuf::from(s), cache))
                .collect(),
            types::TabKind::Favourite => self
                .sounds
                .iter()
                .filter(|(_, v)| v.tags.contains(&"favourite".to_string()))
                .map(|(path, _)| get_sound_file(&PathBuf::from(path), cache))
                .collect(),
        }
    }

    pub fn add_tab(&mut self, name: String, kind: types::TabKind, path: Option<String>) {
        let tab = types::Tab {
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

    pub fn get_tabs(&self) -> Vec<types::Tab> {
        self.tabs.clone()
    }

    pub fn get_tab(&self, id: String) -> Option<types::Tab> {
        self.tabs.iter().find(|t| t.id == id).cloned()
    }

    pub fn edit_tab(&mut self, tab: types::Tab) {
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
