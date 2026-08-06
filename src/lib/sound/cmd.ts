import { invoke } from "@tauri-apps/api/core";
import { produce } from "solid-js/store";
import { SoundEntry, Progress, PlaylistMode } from "../types";
import { showNotification } from "../notifications";
import {
  playlistMode,
  sounds,
  setSounds,
  setSoundState,
  setMicState,
  soundState,
} from "./state";
import { handleSoundFinished } from "./playlist";

let progressInterval: ReturnType<typeof setInterval> | null = null;
let polling = false;

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
          playlistMode: mode,
          speed: speed,
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

// Seek sound to a specific position (updates only latest id)
export function handleSeekCommit(entry: SoundEntry, value: number) {
  const latestId = entry.ids[entry.ids.length - 1];
  seekSound(latestId, value);
  const i = sounds.findIndex((s) => s.path === entry.path);
  if (i !== -1) setSounds(i, "current", value);
}

export function startProgressPolling() {
  if (progressInterval) return;
  progressInterval = setInterval(async () => {
    if (!sounds.length || polling) return;
    polling = true;
    try {
      // Get snapshot of all sounds in async before processing
      const snapshots = await Promise.all(
        sounds.map(async (s) => ({
          path: s.path,
          playlistMode: s.playlistMode,
          progresses: await Promise.all(s.ids.map((id) => getProgress(id))),
          ids: s.ids,
        }))
      );

      // Process synchronously each sound snapshot while they cant be changed
      for (const { path, playlistMode, progresses, ids } of snapshots) {
        const activeIds = ids.filter((_: number, j: number) => !!progresses[j]);
        const i = sounds.findIndex((s) => s.path === path);
        if (i === -1) continue;

        // Handle sounds for path finished
        if (activeIds.length === 0) {
          if (playlistMode !== "disabled") handleSoundFinished(path, playlistMode);
          removeSound(path);
        } else {
          // Update progress for active ids
          const latestProgress = progresses[ids.indexOf(activeIds[activeIds.length - 1])];
          setSounds(i, "ids", activeIds);
          setSounds(i, "current", latestProgress!.current);
          setSounds(i, "total", latestProgress!.total);
        }
      }
    } finally {
      polling = false;
    }
  }, 100);
}

export function stopProgressPolling() {
  if (progressInterval) clearInterval(progressInterval);
  progressInterval = null;
}

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
  const id = await playSoundCmd(path, soundState.volume / 100, soundState.speed);
  if (id === undefined) return;

  registerSound(id, path, mode, soundState.speed);
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

export const setSoundPlaybackSpeed = (id: number, speed: number) =>
  invoke("set_playback_speed", { id, speed });

export const setAllSoundPlaybackSpeed = async (speed: number) => {
  setSoundState({ speed });
  await Promise.all(
    sounds.flatMap((sound) =>
      sound.ids.map((id) => setSoundPlaybackSpeed(id, speed)))
  );
  setSounds(produce((s) => s.forEach((entry) => { entry.speed = speed; })));
};

export function handleVolumeSlider(e: Event) {
  const value = parseFloat((e.currentTarget as HTMLInputElement).value);
  setSoundState({ volume: value });
  setGeneralVolume(value / 100);
}

export function handleSpeedSlider(e: Event) {
  const value = parseFloat((e.currentTarget as HTMLInputElement).value);
  setSoundState({ speed: value });
  setAllSoundPlaybackSpeed(value);
}

export function handleMicVolumeSlider(e: Event) {
  const value = parseFloat((e.currentTarget as HTMLInputElement).value);
  setMicState({ volume: value });
  setMicVolume(value / 100);
}
