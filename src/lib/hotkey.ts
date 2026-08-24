import { createResource } from "solid-js";
import {
  setSounds,
  paused,
  soundState,
  micState,
  setSoundState,
  setMicState,
} from "./sound";
import { commands, HotKeyEntry } from "../bindings";
import { ControlAction } from "./types";
import { produce } from "solid-js/store";

export const controlActions: Record<ControlAction, () => void | Promise<void>> =
  {
    Mute: () => {
      const nowMuted = !soundState.muted;
      setSoundState("muted", nowMuted);
      commands.setGeneralVolume(nowMuted ? 0 : soundState.volume / 100);
    },
    MicMute: () => {
      const nowMuted = !micState.muted;
      setMicState("muted", nowMuted);
      commands.setMicVolume(nowMuted ? 0 : micState.volume / 100);
    },
    StopAll: () => {
      commands.stopAllSounds();
      setSounds([]);
    },
    PauseResumeAll: async () => {
      const ids = await commands.getActiveSounds();
      const newPaused = !paused();

      if (newPaused) {
        ids.forEach((id) => commands.pauseSound(id));
      } else {
        ids.forEach((id) => commands.resumeSound(id));
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

export const [hotkeys, { refetch: refetchHotkeys }] =
  createResource(commands.getHotkeys);

export async function registerHotkey(entry: HotKeyEntry) {
  await commands.registerHotkey(entry);
  refetchHotkeys();
}

export async function unregisterHotkey(id: string) {
  await commands.unregisterHotkey(id);
  refetchHotkeys();
}

export function findHotkeyForSound(path: string) {
  return hotkeys()?.find((hk) => hk.context === path);
}
