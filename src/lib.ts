import { invoke } from "@tauri-apps/api/core";
import type { Progress, SoundTab } from "./types";

export const getTabs = () => invoke<[SoundTab, string[]][]>("get_tabs");
export const addTab = (name: string, path: string) => invoke("add_tab", { name, path });
export const removeTab = (id: string) => invoke("remove_tab", { id });

export const playSound = (path: string, volume: number) =>
  invoke<number>("play_sound", { path, volume });

export const getActiveSounds = () => invoke<number[]>("get_active_sounds");

export const pauseSound = (id: number) => invoke("pause_sound", { id });

export const resumeSound = (id: number) => invoke("resume_sound", { id });

export const stopSound = (id: number) => invoke("stop_sound", { id });

export const stopAllSounds = () => invoke("stop_all_sounds");

export const seekSound = (id: number, secs: number) =>
  invoke("seek_sound", { id, secs });

export const setGeneralVolume = (volume: number) =>
  invoke("set_general_volume", { volume });

export const getProgress = (id: number) =>
  invoke<Progress | null>("get_progress", { id });

export const getMicVolume = () => invoke<number>("get_mic_volume");

export const setMicVolume = (volume: number) =>
  invoke("set_mic_volume", { volume });

export function formatTime(secs: number): string {
  if (!isFinite(secs) || secs < 0) return "0:00";
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}
