use crate::config;

const NOCTALIA_TEMPLATE: &str = r#"/* This file was automatically added by Open SoundBoard for Noctalia templates. Please do not edit. */

:root {
  --theme-text: {{ colors.on_surface.default.hex }};
  --theme-mantle: {{ colors.surface_container_low.default.hex }};
  --theme-crust: {{ colors.surface_container_lowest.default.hex }};
  --theme-base: {{ colors.surface.default.hex }};
  --theme-surface-0: {{ colors.surface_container.default.hex }};
  --theme-surface-1: {{ colors.surface_container_high.default.hex }};
  --theme-surface-2: {{ colors.surface_container_highest.default.hex }};
  --theme-subtext-1: {{ colors.on_surface_variant.default.hex }};
  --theme-subtext-0: {{ colors.outline.default.hex }};
  --theme-innertext: {{ colors.on_primary.default.hex }};
  --theme-error: {{ colors.error.default.hex }};
  --theme-warn: {{ colors.tertiary.default.hex }};
  --theme-info: {{ colors.secondary.default.hex }};

  --theme-primary-50: {{ palettes.primary.98.hex }};
  --theme-primary-100: {{ palettes.primary.95.hex }};
  --theme-primary-200: {{ palettes.primary.90.hex }};
  --theme-primary-300: {{ palettes.primary.80.hex }};
  --theme-primary-400: {{ palettes.primary.70.hex }};
  --theme-primary-500: {{ palettes.primary.60.hex }};
  --theme-primary-600: {{ palettes.primary.50.hex }};
  --theme-primary-700: {{ palettes.primary.40.hex }};
  --theme-primary-800: {{ palettes.primary.30.hex }};
  --theme-primary-900: {{ palettes.primary.20.hex }};
  --theme-primary-950: {{ palettes.primary.10.hex }};
}
"#;

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

    pub fn install_noctalia_theme(path: &std::path::Path) -> Result<(), String> {
        // Dont write same content again.
        if std::fs::read_to_string(path).is_ok_and(|c| c == NOCTALIA_TEMPLATE) {
            return Ok(());
        }

        let dir = path.parent().ok_or("Invalid template path")?;
        std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
        std::fs::write(path, NOCTALIA_TEMPLATE).map_err(|e| e.to_string())
    }
}
