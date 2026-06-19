import { Cherry, SettingsIcon } from "lucide-solid";
import { Tab } from "./types";

export const CONTROL_ACTIONS = ["Mute", "MicMute", "StopAll", "PauseResumeAll"];

export const TABS = {
  [Tab.Dashboard]: { icon: Cherry },
  [Tab.Settings]: { icon: SettingsIcon },
};

export const SETTINGS_TABS = [
  { id: "general", label: "General" },
  { id: "hotkeys", label: "Hotkeys" },
] as const;
