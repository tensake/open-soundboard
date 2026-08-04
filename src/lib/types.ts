export enum Tab {
  Dashboard = "dashboard",
  Audio = "audio",
  Settings = "settings",
}

export type AlertKind = "Warn" | "Error";
export type HotKeyKind = "Sound" | "Control";
export type ControlAction = "Mute" | "MicMute" | "StopAll" | "PauseResumeAll";
export type PlaylistMode = "disabled" | "repeat" | "shuffle";
export type SortOrder = "Default" | "Size" | "Date" | "Duration";

export interface Alert {
  kind: AlertKind;
  title: string;
  message: string;
}

export interface HotKeyEntry {
  id: string;
  binding: string;
  kind: HotKeyKind;
  context: string;
}

export interface Progress {
  current: number;
  total: number;
}

export type SoundTab = {
  id: string;
  name: string;
  path: string;
};

export interface SoundFile {
  path: string;
  size: number;
  datetime: number;
  duration: number;
}

// Represents all sounds bound to a single file.
//
// For example, if same sound is played multiple times,
// all their ids will be represented as one SoundEntry.
// Progress and pause state reflect the latest instance only.
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

export interface AudioApp {
  id: number;
  name: string;
  icon: string | null;
}
