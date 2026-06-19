import { Cherry, SettingsIcon } from "lucide-solid";
import { Tab } from "./types";

export const CONTROL_ACTIONS = ["Mute", "MicMute", "StopAll", "PauseResumeAll"];

export const TABS = {
  [Tab.Dashboard]: { icon: Cherry },
  [Tab.Settings]: { icon: SettingsIcon },
};
