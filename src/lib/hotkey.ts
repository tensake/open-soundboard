import { createResource } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import type { HotKeyEntry } from "./types";
import {
  setSounds,
  paused,
  setGeneralVolume,
  setMicVolume,
  stopAllSounds,
  getActiveSounds,
  pauseSound,
  resumeSound,
  soundState,
  micState,
  setSoundState,
  setMicState,
} from "./sound";
import { ControlAction } from "./types";
import { produce } from "solid-js/store";

export const controlActions: Record<ControlAction, () => void | Promise<void>> =
  {
    Mute: () => {
      const nowMuted = !soundState.muted;
      setSoundState("muted", nowMuted);
      setGeneralVolume(nowMuted ? 0 : soundState.volume / 100);
    },
    MicMute: () => {
      const nowMuted = !micState.muted;
      setMicState("muted", nowMuted);
      setMicVolume(nowMuted ? 0 : micState.volume / 100);
    },
    StopAll: () => {
      stopAllSounds();
      setSounds([]);
    },
    PauseResumeAll: async () => {
      const ids = await getActiveSounds();
      const newPaused = !paused();

      if (newPaused) {
        ids.forEach(pauseSound);
      } else {
        ids.forEach(resumeSound);
      }

      setSounds(
        produce((s) => {
          s.forEach((entry) => {
            entry.paused = newPaused;
          });
        }),
      );
    },
  };

export const registerHotkeyCmd = (hk: HotKeyEntry) =>
  invoke("register_hotkey", { hk });

export const updateHotkey = (hk: HotKeyEntry) =>
  invoke("update_hotkey", { hk });

export const unregisterHotkeyCmd = (id: string) =>
  invoke("unregister_hotkey", { id });

async function fetchHotkeys(): Promise<HotKeyEntry[]> {
  return invoke<HotKeyEntry[]>("get_hotkeys");
}

export const [hotkeys, { refetch: refetchHotkeys }] =
  createResource(fetchHotkeys);

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
