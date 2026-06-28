import DashboardIcon from "../components/ui/icons/dashboardIcon";
import { Cable, SettingsIcon } from "lucide-solid";

import { Tab, PlaylistMode } from "./types";

export const CONTROL_ACTIONS = ["Mute", "MicMute", "StopAll", "PauseResumeAll"];
export const PLAYLIST_ORDER: PlaylistMode[] = ["disabled", "repeat", "shuffle"];

export const TABS = {
  [Tab.Dashboard]: { icon: DashboardIcon },
  [Tab.Forwarding]: { icon: Cable },
  [Tab.Settings]: { icon: SettingsIcon },
};

export const SETTINGS_TABS = [
  { id: "sound", label: "Sound" },
  { id: "appearance", label: "Appearance" },
  { id: "hotkeys", label: "Hotkeys" },
  { id: "system", label: "System" },
] as const;
