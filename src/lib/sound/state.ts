
import { createSignal } from "solid-js";
import { createStore } from "solid-js/store";
import { PlaylistMode, SoundEntry } from "../types";
import { getVolume, getMicVolume } from "./cmd";

export const [soundVolumeSignal, setSoundVolumeSignal] = createSignal(100);
export const [micVolumeSignal, setMicVolumeSignal] = createSignal(100);
export const [micPitchSignal, setMicPitchSignal] = createSignal(0);
export const [soundPlaybackSpeed, setSoundPlaybackSpeed] = createSignal(1.0);
export const [muted, setMuted] = createSignal(0);
export const [micMuted, setMicMuted] = createSignal(0);
export const [paused, setPaused] = createSignal(false);
export const [sounds, setSounds] = createStore<SoundEntry[]>([]);
export const [playlistMode, setPlaylistMode] =
  createSignal<PlaylistMode>("disabled");
export const [currentTabPaths, setCurrentTabPaths] = createSignal<string[]>([]);
export const [finishedPlaylistSound, setFinishedPlaylistSound] = createSignal<{
  path: string;
  mode: PlaylistMode;
} | null>(null);

export async function initConfig() {
  setSoundVolumeSignal(Math.round(await getVolume() * 100));
  setMicVolumeSignal(Math.round(await getMicVolume() * 100));
}
