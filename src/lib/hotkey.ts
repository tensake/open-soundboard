import { createResource } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import type { HotKeyEntry } from "./types";

export const registerHotkeyCmd = (hk: HotKeyEntry) => invoke("register_hotkey", { hk });

export const updateHotkey = (hk: HotKeyEntry) => invoke("update_hotkey", { hk });

export const unregisterHotkeyCmd = (id: string) => invoke("unregister_hotkey", { id });

async function fetchHotkeys(): Promise<HotKeyEntry[]> {
  return invoke<HotKeyEntry[]>("get_hotkeys");
}

export const [hotkeys, { refetch: refetchHotkeys }] = createResource(fetchHotkeys);

export async function registerHotkey(entry: HotKeyEntry) {
  await registerHotkeyCmd(entry);
  refetchHotkeys();
}

export async function unregisterHotkey(id: string) {
  await unregisterHotkeyCmd(id);
  refetchHotkeys();
}

export function findHotkeyForSound(path: string) {
  return hotkeys()?.find((hk) => hk.context === path);
}
