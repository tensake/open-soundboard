export enum UITabKind {
  Dashboard = "dashboard",
  Audio = "audio",
  Settings = "settings",
}

export type ControlAction = "Mute" | "MicMute" | "StopAll" | "PauseResumeAll";
export type PlaylistMode = "disabled" | "repeat" | "shuffle";
export type SortOrder = "Default" | "Size" | "Date" | "Duration";

// Represents all sounds bound to a single file.
export interface SoundEntry {
  ids: number[];
  path: string;
  current: number;
  total: number;
  paused: boolean;
  speed: number;
  playlistMode: PlaylistMode;
}

export interface ForwardedApp {
  id: number;
  pid: number;
  volume: number;
  paused: boolean;
}
