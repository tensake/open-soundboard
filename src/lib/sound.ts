import { invoke } from "@tauri-apps/api/core";
import { Progress } from "./types";
import { createSignal, createEffect } from "solid-js";
import { createStore, produce } from "solid-js/store";
import { ControlAction, SoundEntry } from "./types";

export const [volumePct, setVolumePct] = createSignal(
  Number(localStorage.getItem("volumePct") ?? 100),
);
export const [micVolumePct, setMicVolumePct] = createSignal(
  Number(localStorage.getItem("micVolumePct") ?? 100),
);
export const [muted, setMuted] = createSignal(0);
export const [micMuted, setMicMuted] = createSignal(0);
export const [paused, setPaused] = createSignal(false);
export const [sounds, setSounds] = createStore<SoundEntry[]>([]);

createEffect(() => {
  localStorage.setItem("volumePct", String(volumePct()));
  localStorage.setItem("micVolumePct", String(micVolumePct()));
});

export function registerSound(id: number, path: string) {
  const existing = sounds.findIndex((s) => s.path === path);

  if (existing !== -1) {
    setSounds(
      produce((s) => {
        const entry = s.splice(existing, 1)[0];
        entry.ids.push(id);
        entry.count += 1;
        entry.current = 0;
        entry.paused = false;
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

  entry.ids.forEach((id) =>
    entry.paused ? resumeSound(id) : pauseSound(id),
  );
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
        removeSound(s.path);
      } else {
        setSounds(i, "current", progress.current);
        setSounds(i, "total", progress.total);
      }
    }),
  );
}, 100);

export const controlActions: Record<ControlAction, () => void | Promise<void>> = {
  Mute: () => {
    if (muted() > 0 && volumePct() === 0) {
      setVolumePct(muted());
      setGeneralVolume(muted() / 100);
      setMuted(0);
    } else {
      setMuted(volumePct());
      setVolumePct(0);
      setGeneralVolume(0);
    }
  },
  MicMute: () => {
    if (micMuted() > 0 && micVolumePct() === 0) {
      setMicVolumePct(micMuted());
      setMicVolume(micMuted() / 100);
      setMicMuted(0);
    } else {
      setMicMuted(micVolumePct());
      setMicVolumePct(0);
      setMicVolume(0);
    }
  },
  StopAll: () => {
    stopAllSounds();
  },
  PauseResumeAll: async () => {
    const ids = await getActiveSounds();
    if (paused()) {
      ids.forEach(resumeSound);
    } else {
      ids.forEach(pauseSound);
    }
    setPaused(!paused());
  },
};

export const playSoundCmd = (path: string, volume: number) =>
  invoke<number>("play_sound", { path, volume });

export async function playSound(path: string) {
  const id = await playSoundCmd(path, volumePct() / 100);
  registerSound(id, path);
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

export const getProgress = (id: number) =>
  invoke<Progress | null>("get_progress", { id });

export const getMicVolume = () => invoke<number>("get_mic_volume");

export const setMicVolume = (volume: number) =>
  invoke("set_mic_volume", { volume });

export function handleVolumeSlider(e: Event) {
  const value = parseFloat((e.currentTarget as HTMLInputElement).value);
  setVolumePct(value);
  setGeneralVolume(value / 100);
}

export function handleMicVolumeSlider(e: Event) {
  const value = parseFloat((e.currentTarget as HTMLInputElement).value);
  setMicVolumePct(value);
  setMicVolume(value / 100);
}
