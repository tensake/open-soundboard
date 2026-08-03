import { invoke } from "@tauri-apps/api/core";
import { produce } from "solid-js/store";
import { SoundEntry, Progress, PlaylistMode } from "../types";
import { showNotification } from "../notifications";
import {
  playlistMode,
  sounds,
  setSounds,
  setFinishedPlaylistSound,
  setMicVolumeSignal,
  setSoundVolumeSignal,
  soundVolumeSignal,
  soundPlaybackSpeed,
} from "./state";

export function registerSound(
  id: number,
  path: string,
  mode: PlaylistMode = "disabled",
  speed: number = 1.0,
) {
  const existing = sounds.findIndex((s) => s.path === path);

  if (existing !== -1) {
    setSounds(
      produce((s) => {
        const entry = s.splice(existing, 1)[0];
        entry.ids.push(id);
        entry.count += 1;
        entry.current = 0;
        entry.paused = false;
        entry.playlistMode = mode;
        entry.speed = speed;
        s.push(entry);
      }),
    );
  } else {
    setSounds(
      produce((s) => {
        s.push({
          ids: [id],
          path,
          current: 0,
          total: 0,
          paused: false,
          count: 1,
          playlistMode: mode,
          speed: 1.0,
        });
      }),
    );
  }
}

export function removeSound(path: string) {
  setSounds(
    produce((s) => {
      const i = s.findIndex((e) => e.path === path);
      if (i !== -1) s.splice(i, 1);
    }),
  );
}

export function handlePauseResume(entry: SoundEntry) {
  const i = sounds.findIndex((s) => s.path === entry.path);
  if (i === -1) return;

  entry.ids.forEach((id) => (entry.paused ? resumeSound(id) : pauseSound(id)));
  setSounds(i, "paused", !entry.paused);
}

export function handleStop(entry: SoundEntry) {
  entry.ids.forEach((id) => stopSound(id));
  removeSound(entry.path);
}

export function handleSeekCommit(entry: SoundEntry, value: number) {
  const latestId = entry.ids[entry.ids.length - 1];
  seekSound(latestId, value);
  const i = sounds.findIndex((s) => s.path === entry.path);
  if (i !== -1) setSounds(i, "current", value);
}

export const _updateProgressInterval = setInterval(async () => {
  if (!sounds.length) return;

  await Promise.all(
    sounds.map(async (s, i) => {
      if (s.paused) return;

      const latestId = s.ids[s.ids.length - 1];
      const progress = await getProgress(latestId);
      if (!progress) {
        if (s.playlistMode !== "disabled") {
          setFinishedPlaylistSound({ path: s.path, mode: s.playlistMode });
        }
        removeSound(s.path);
      } else {
        setSounds(i, "current", progress.current);
        setSounds(i, "total", progress.total);
      }
    }),
  );
}, 100);

export async function playSoundCmd(
  path: string,
  volume: number,
  speed: number,
) {
  try {
    return await invoke<number>("play_sound", { path, volume, speed });
  } catch (e) {
    console.error(e);
    showNotification("Error while playing sound file", String(e));
  }
}

export async function playSoundTagged(path: string, mode: PlaylistMode) {
  const id = await playSoundCmd(path, soundVolumeSignal() / 100, soundPlaybackSpeed());
  if (id === undefined) return;

  registerSound(id, path, mode, soundPlaybackSpeed());
}
export async function playSoundTabMode(path: string) {
  return playSoundTagged(path, playlistMode());
}
export async function playSound(path: string) {
  return playSoundTagged(path, "disabled");
}

export const getActiveSounds = () => invoke<number[]>("get_active_sounds");

export const pauseSound = (id: number) => invoke("pause_sound", { id });

export const resumeSound = (id: number) => invoke("resume_sound", { id });

export const stopSound = (id: number) => invoke("stop_sound", { id });

export const stopAllSounds = () => invoke("stop_all_sounds");

export const seekSound = (id: number, secs: number) =>
  invoke("seek_sound", { id, secs });

export const setGeneralVolume = (volume: number) =>
  invoke("set_general_volume", { volume });

export const getVolume = () => invoke<number>("get_volume");
export const getProgress = (id: number) =>
  invoke<Progress | null>("get_progress", { id });

export const getMicVolume = () => invoke<number>("get_mic_volume");

export const setMicVolume = (volume: number) =>
  invoke("set_mic_volume", { volume });

export const setMicPitch = (semitones: number) =>
  invoke("set_mic_pitch", { semitones });

export const getMicPitch = () => invoke<number>("get_mic_pitch");

export const setPlaybackSpeed = (id: number, speed: number) =>
  invoke("set_playback_speed", { id, speed });

export function handleVolumeSlider(e: Event) {
  const value = parseFloat((e.currentTarget as HTMLInputElement).value);
  setSoundVolumeSignal(value);
  setGeneralVolume(value / 100);
}

export function handleMicVolumeSlider(e: Event) {
  const value = parseFloat((e.currentTarget as HTMLInputElement).value);
  setMicVolumeSignal(value);
  setMicVolume(value / 100);
}
