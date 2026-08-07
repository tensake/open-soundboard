import { PLAYLIST_ORDER } from "../constants";
import {
  playlistMode,
  sounds,
  setSounds,
  setPlaylistMode,
} from "./state";
import { playSoundTagged } from "./cmd";
import { currentTabPaths } from "../config";
import { PlaylistMode } from "../types";

export function handleSoundFinished(path: string, mode: PlaylistMode) {
  if (mode === "repeat") {
    playSoundTagged(path, "repeat");
    return;
  }

  if (mode === "shuffle") {
    const paths = currentTabPaths();
    let next = path;
    if (paths.length > 1) {
      do {
        next = paths[Math.floor(Math.random() * paths.length)];
      } while (next === path);
    }
    playSoundTagged(next, "shuffle");
  }
}

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
