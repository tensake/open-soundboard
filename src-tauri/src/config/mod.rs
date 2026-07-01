//! Configuration for the application.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use uuid::Uuid;

pub mod customcss;
pub mod hotkey;
pub mod tab;

const DATA_FILE: &str = "data.json";
const CSS_FILE: &str = "style.css";

/// Represents the application configuration.
///
/// The config is taken from a JSON file and is saved on changes.
#[derive(Serialize, Deserialize, Debug)]
pub struct Config {
    tabs: Vec<tab::Tab>,
    hotkeys: HashMap<Uuid, hotkey::HotKeyEntry>,
    onboarded: bool,
    normalize: bool,

    #[serde(skip)]
    path: PathBuf,
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
            hotkeys: HashMap::new(),
            onboarded: false,
            normalize: false,
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

    pub fn onboarded(&self) -> bool {
        self.onboarded
    }

    pub fn normalize(&self) -> bool {
        self.normalize
    }

    pub fn set_normalize(&mut self, n: bool) {
        self.normalize = n;
        self.save();
    }

    pub fn onboard(&mut self) {
        self.onboarded = true;
        self.save();
    }
}

fn list_path(path: PathBuf) -> Result<Vec<PathBuf>, std::io::Error> {
    let mut files = Vec::new();
    for entry in fs::read_dir(&path)?.flatten() {
        files.push(entry.path());
    }
    Ok(files)
}
