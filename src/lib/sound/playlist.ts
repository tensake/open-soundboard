import { PLAYLIST_ORDER } from "../constants";
import { createEffect } from "solid-js";
import {
  playlistMode,
  sounds,
  setSounds,
  setPlaylistMode,
  finishedPlaylistSound,
  setFinishedPlaylistSound,
  currentTabPaths,
} from "./state";
import { playSoundTagged } from "./cmd";

createEffect(() => {
  const finished = finishedPlaylistSound();
  if (!finished) return;
  setFinishedPlaylistSound(null);

  if (finished.mode === "repeat") {
    playSoundTagged(finished.path, "repeat");
    return;
  }

  if (finished.mode === "shuffle") {
    const tabSounds = currentTabPaths();
    if (tabSounds.length === 0) return;

    let next = finished.path;
    if (tabSounds.length > 1) {
      do {
        next = tabSounds[Math.floor(Math.random() * tabSounds.length)];
      } while (next === finished.path);
    }
    playSoundTagged(next, "shuffle");
  }
});

export function nextPlaylistMode() {
  const idx = PLAYLIST_ORDER.indexOf(playlistMode());
  setPlaylistMode(PLAYLIST_ORDER[(idx + 1) % PLAYLIST_ORDER.length]);
}
export function nextSoundPlaylistMode(path: string) {
  const i = sounds.findIndex((s) => s.path === path);
  if (i === -1) return;
  const idx = PLAYLIST_ORDER.indexOf(sounds[i].playlistMode);
  setSounds(
    i,
    "playlistMode",
    PLAYLIST_ORDER[(idx + 1) % PLAYLIST_ORDER.length],
  );
}
