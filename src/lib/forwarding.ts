import { createSignal } from "solid-js";
import { createStore } from "solid-js/store";
import { ForwardedApp } from "./types";
import { commands, AudioApp } from "../bindings";
import { unwrap, unwrapOrThrow } from "./utils";

export const [audioApps, setAudioApps] = createSignal<AudioApp[]>([]);
export const [forwardedApps, setForwardedApps] = createStore<ForwardedApp[]>([]);

export async function refreshAudioApps(): Promise<AudioApp[]> {
  const apps = unwrap(await commands.getAudioApps()) ?? [];
  setAudioApps(apps);
  return apps;
}

export async function forwardApp(pid: number): Promise<number> {
  const id = unwrapOrThrow(await commands.forwardApp(pid));
  setForwardedApps(forwardedApps.length, { id, pid, volume: 1, paused: false });
  return id;
}

export async function stopForward(id: number): Promise<void> {
  unwrapOrThrow(await commands.stopForward(id));
  setForwardedApps(apps => apps.filter(a => a.id !== id));
}

export async function setForwardVolume(id: number, volume: number): Promise<void> {
  unwrapOrThrow(await commands.setForwardVolume(id, volume));
  const i = forwardedApps.findIndex(a => a.id === id);
  if (i !== -1) setForwardedApps(i, "volume", volume);
}
