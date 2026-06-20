import { invoke } from "@tauri-apps/api/core";
import { createSignal } from "solid-js";

export const [autoStartSignal, setAutoStartSignal] = createSignal(false);

getAutoStart().then(setAutoStartSignal);

export function formatTime(secs: number): string {
  if (!isFinite(secs) || secs < 0) return "0:00";
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export async function markAsReady() {
  await invoke("mark_as_ready");
}

export async function setAutoStart(value: boolean) {
  setAutoStartSignal(value);
  await invoke("set_autostart", { enabled: value });
}

export async function getAutoStart(): Promise<boolean> {
  return await invoke("get_autostart");
}
