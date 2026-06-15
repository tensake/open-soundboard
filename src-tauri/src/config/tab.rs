use crate::config;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

const ALLOWED_FILE_EXT: [&str; 8] = [
    "mp3", "wav", "flac", "vorbis", "ogg", "isomp4", "aac", "pcm",
];

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Tab {
    id: String,
    name: String,
    path: String,
}

impl Tab {
    pub fn list_sounds(&self) -> Vec<PathBuf> {
        config::list_path(PathBuf::from(&self.path))
            .unwrap_or_default()
            .into_iter()
            .filter(|p| {
                p.extension()
                    .and_then(|e| e.to_str())
                    .map(|e| ALLOWED_FILE_EXT.contains(&e.to_lowercase().as_str()))
                    .unwrap_or(false)
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
}
