
import { createSignal, createMemo } from "solid-js";
import { createStore } from "solid-js/store";
import { PlaylistMode, SoundEntry } from "../types";
import { getVolume, getMicVolume } from "./cmd";

export const [soundState, setSoundState] = createStore({
  volume: 100,
  muted: false,
  speed: 1.0,
});
export const [micState, setMicState] = createStore({
  volume: 100,
  muted: false,
  pitch: 0,
});
export const [sounds, setSounds] = createStore<SoundEntry[]>([]);
export const [playlistMode, setPlaylistMode] =
  createSignal<PlaylistMode>("disabled");
export const paused = createMemo(() =>
  sounds.length > 0 && sounds.every(s => s.paused)
);

export async function initConfig() {
  setSoundState({ volume: Math.round(await getVolume() * 100) });
  setMicState({ volume: Math.round(await getMicVolume() * 100) });
}
