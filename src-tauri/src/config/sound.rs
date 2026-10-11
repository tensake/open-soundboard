//! Configure specific sounds and set custom attributes.

use crate::config;
use crate::types::SoundConfig;
use std::collections::HashMap;

impl config::Config {
    /// Set the sound configuration for the given key.
    pub fn set_sound_config(&mut self, key: &str, config: SoundConfig) -> Result<(), String> {
        self.sounds.insert(key.to_owned(), config);
        Ok(())
    }

    /// Get sound config for the given key.
    pub fn get_sound_config(&self, key: &str) -> Option<SoundConfig> {
        self.sounds.get(key).cloned()
    }

    /// Get all sound configs.
    pub fn get_sounds_config(&self) -> &HashMap<String, SoundConfig> {
        &self.sounds
    }
}
