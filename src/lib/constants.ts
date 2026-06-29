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

export const ONBOARDING_STEPS = [
  {
    title: "Welcome!",
    description:
      "Thanks for downloading Open Soundboard, I hope you enjoy using it!",
    image: undefined,
  },
  {
    title: "Get started with sounds",
    description:
      "To play sounds you need to add a tab first. Press 'Add tab' and select a folder that has some sounds in it, then you can click a sound file in the tab to play it.",
    image: "onboarding/1_sounds.jpg",
  },
  {
    title: "Setup hotkeys",
    description:
      "In settings, You can configure hotkeys for a specific sound or for actions like stopping all sounds and others. Just hover over a sound in a tab and on the right side click the hotkey button. You can view all hotkeys in the settings.",
    image: "onboarding/2_hotkeys.jpg",
  },
  {
    title: "Tweak settings to your liking",
    description:
      "In settings you can customize the appearance of the soundboard by using custom CSS, set the soundboard to start with the system or configure sounds' speed or pitch of your microphone and a lot more.",
    image: "onboarding/3_settings.jpg",
  },
  {
    title: "Have fun!",
    description:
      "All done! If you have found any bugs or have any feature in mind, please create an issue on https://github.com/tensake/open-soundboard/issues",
    image: undefined,
  },
];
