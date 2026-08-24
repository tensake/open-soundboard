
import { createSignal, createMemo } from "solid-js";
import { createStore } from "solid-js/store";
import { commands } from "../../bindings";
import { PlaylistMode, SoundEntry } from "../types";

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
  setSoundState({ volume: Math.round(await commands.getVolume() * 100) });
  setMicState({ volume: Math.round(await commands.getMicVolume() * 100) });
}
