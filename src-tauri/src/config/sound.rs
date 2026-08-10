//! Configure specific sounds and set custom attributes.

use crate::config;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Representation of the customisation for the sound, use path as key.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SoundConfig {
    /// Tags associated with the sound.
    pub tags: Vec<String>,
    /// List of tabs that the sound is pinned to.
    pub pins: Vec<String>,
    /// List of usertabs that the sound is added to.
    pub usertabs: Vec<String>,
}

impl config::Config {
    /// Set the sound configuration for the given key.
    pub fn set_sound_config(&mut self, key: &String, config: SoundConfig) -> Result<(), String> {
        self.sounds.insert(key.clone(), config);
        Ok(())
    }

    /// Get sound config for the given key.
    pub fn get_sound_config(&self, key: &String) -> Option<SoundConfig> {
        self.sounds.get(key).cloned()
    }

    /// Get all sound configs.
    pub fn get_sounds_config(&self) -> &HashMap<String, SoundConfig> {
        &self.sounds
    }
}
