use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

const DATA_FILE: &str = "data.json";
const ALLOWED_FILE_EXT: [&str; 8] = [
    "mp3", "wav", "flac", "vorbis", "ogg", "isomp4", "aac", "pcm",
];

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Tab {
    id: String,
    name: String,
    path: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct Config {
    tabs: Vec<Tab>,
    #[serde(skip)]
    path: PathBuf,
}

impl Tab {
    pub fn list_sounds(&self) -> Vec<PathBuf> {
        list_path(PathBuf::from(&self.path))
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

impl Config {
    pub fn new(path: PathBuf) -> Config {
        Self::load(path)
    }

    fn load(path: PathBuf) -> Config {
        // Ensure directory exists
        fs::create_dir_all(&path).expect("Failed to create config directory");

        // Read config file
        let file = path.join(DATA_FILE);
        if let Ok(s) = fs::read_to_string(&file) {
            if let Ok(mut cfg) = serde_json::from_str::<Config>(&s) {
                cfg.path = path;
                return cfg;
            }
        }

        Config {
            tabs: Vec::new(),
            path,
        }
    }

    fn save(&self) {
        // Ensure directory exists
        fs::create_dir_all(&self.path).expect("Failed to create config directory");

        // Write config
        let contents = serde_json::to_string_pretty(self).expect("Failed to serialize config");
        fs::write(self.path.join(DATA_FILE), contents).expect("Failed to write config file");
    }

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

fn list_path(path: PathBuf) -> Result<Vec<PathBuf>, std::io::Error> {
    let mut files = Vec::new();
    for entry in fs::read_dir(&path)?.flatten() {
        files.push(entry.path());
    }
    Ok(files)
}
