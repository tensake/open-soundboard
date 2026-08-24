import DashboardIcon from "../components/ui/icons/dashboardIcon";
import { AudioLines, SettingsIcon } from "lucide-solid";
import { UITabKind, PlaylistMode } from "./types";

export const CONTROL_ACTIONS = ["Mute", "MicMute", "StopAll", "PauseResumeAll"];
export const PLAYLIST_ORDER: PlaylistMode[] = ["disabled", "repeat", "shuffle"];
export const SORT_ORDER = ["Default", "Size", "Date", "Duration"];

export const TABS = {
  [UITabKind.Dashboard]: { icon: DashboardIcon },
  [UITabKind.Audio]: { icon: AudioLines },
  [UITabKind.Settings]: { icon: SettingsIcon },
};

export const SETTINGS_TABS = [
  { id: "general", label: "General" },
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
    title: "Tweak settings to your liking",
    description:
      "In settings you can customize the appearance, configure sounds' speed, pitch of your microphone, setup hotkeys and a lot more.",
    image: "onboarding/1_hotkeys.png",
  },
  {
    title: "Let's get started!",
    description:
      "Have a look around. If you have found any bugs or have any feature in mind, please create an issue on https://github.com/tensake/open-soundboard/issues",
    image: undefined,
  },
];
