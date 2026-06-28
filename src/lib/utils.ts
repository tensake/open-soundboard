import { invoke } from "@tauri-apps/api/core";
import { createSignal } from "solid-js";

export const [autoStartSignal, setAutoStartSignal] = createSignal(false);
export const [onboardedSignal, setOnboarded] = createSignal(false);

getAutoStart().then(setAutoStartSignal);
isOnboarded().then(setOnboarded);

export function formatTime(secs: number): string {
  if (!isFinite(secs) || secs < 0) return "0:00";
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60)
    .toString()
    .padStart(2, "0");
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

/** Checks if the user has completed the onboarding. **/
export function isOnboarded(): Promise<boolean> {
  return invoke("is_onboarded");
}

/** Sets the onboarding status to completed. **/
export async function onboard() {
  await invoke("onboard");
  setOnboarded(true);
}
