import { invoke } from "@tauri-apps/api/core";
import { createSignal } from "solid-js";
import { ForwardedApp, AudioApp } from "./types";

export const [audioApps, setAudioApps] = createSignal<AudioApp[]>([]);
export const [forwardedApps, setForwardedApps] = createSignal<ForwardedApp[]>([]);

export async function refreshAudioApps(): Promise<AudioApp[]> {
  const apps = await invoke<AudioApp[]>("get_audio_apps");
  setAudioApps(apps);
  return apps;
}

export async function forwardApp(pid: number): Promise<number> {
  const id = await invoke<number>("forward_app", { pid });
  setForwardedApps((prev) => [...prev, { id, pid, volume: 1, paused: false }]);
  return id;
}

export async function stopForward(id: number): Promise<void> {
  await invoke("stop_forward", { id });
  setForwardedApps((prev) => prev.filter((a) => a.id !== id));
}

export async function setForwardVolume(id: number, volume: number): Promise<void> {
  await invoke("set_forward_volume", { id, volume });
  setForwardedApps((prev) =>
    prev.map((a) => (a.id === id ? { ...a, volume } : a)),
  );
}
