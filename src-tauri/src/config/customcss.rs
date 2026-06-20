use crate::config;

impl config::Config {
    pub fn get_custom_css(&self) -> Result<String, String> {
        let file = self.path.join(config::CSS_FILE);

        if file.exists() {
            std::fs::read_to_string(&file).map_err(|e| e.to_string())
        } else {
            Ok(String::new())
        }
    }

    pub fn save_custom_css(&self, css: &str) -> Result<(), String> {
        std::fs::write(self.path.join(config::CSS_FILE), css).map_err(|e| e.to_string())
    }
}
