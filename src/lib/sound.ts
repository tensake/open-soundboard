import { invoke } from "@tauri-apps/api/core";
import { Progress, PlaylistMode } from "./types";
import { createSignal, createEffect } from "solid-js";
import { createStore, produce } from "solid-js/store";
import { ControlAction, SoundEntry } from "./types";
import { PLAYLIST_ORDER } from "./constants";
import { showNotification } from "./notifications";

export const [volumePct, setVolumePct] = createSignal(
  Number(localStorage.getItem("volumePct") ?? 100),
);
export const [micVolumePct, setMicVolumePct] = createSignal(
  Number(localStorage.getItem("micVolumePct") ?? 100),
);
export const [micPitchPct, setMicPitchPct] = createSignal(0);
export const [soundPlaybackSpeed, setSoundPlaybackSpeed] = createSignal(1.0);
export const [muted, setMuted] = createSignal(0);
export const [micMuted, setMicMuted] = createSignal(0);
export const [paused, setPaused] = createSignal(false);
export const [sounds, setSounds] = createStore<SoundEntry[]>([]);
export const [playlistMode, setPlaylistMode] =
  createSignal<PlaylistMode>("disabled");
export const [currentTabPaths, setCurrentTabPaths] = createSignal<string[]>([]);
export const [finishedPlaylistSound, setFinishedPlaylistSound] = createSignal<{
  path: string;
  mode: PlaylistMode;
} | null>(null);

export function nextPlaylistMode() {
  const idx = PLAYLIST_ORDER.indexOf(playlistMode());
  setPlaylistMode(PLAYLIST_ORDER[(idx + 1) % PLAYLIST_ORDER.length]);
}
export function nextSoundPlaylistMode(path: string) {
  const i = sounds.findIndex((s) => s.path === path);
  if (i === -1) return;
  const idx = PLAYLIST_ORDER.indexOf(sounds[i].playlistMode);
  setSounds(
    i,
    "playlistMode",
    PLAYLIST_ORDER[(idx + 1) % PLAYLIST_ORDER.length],
  );
}

createEffect(() => {
  const finished = finishedPlaylistSound();
  if (!finished) return;
  setFinishedPlaylistSound(null);

  if (finished.mode === "repeat") {
    playSoundTagged(finished.path, "repeat");
    return;
  }

  if (finished.mode === "shuffle") {
    const tabSounds = currentTabPaths();
    if (tabSounds.length === 0) return;

    let next = finished.path;
    if (tabSounds.length > 1) {
      do {
        next = tabSounds[Math.floor(Math.random() * tabSounds.length)];
      } while (next === finished.path);
    }
    playSoundTagged(next, "shuffle");
  }
});

createEffect(() => {
  localStorage.setItem("volumePct", String(volumePct()));
  localStorage.setItem("micVolumePct", String(micVolumePct()));
});

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
        entry.count += 1;
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
          count: 1,
          playlistMode: mode,
          speed: 1.0,
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
        if (s.playlistMode !== "disabled") {
          setFinishedPlaylistSound({ path: s.path, mode: s.playlistMode });
        }
        removeSound(s.path);
      } else {
        setSounds(i, "current", progress.current);
        setSounds(i, "total", progress.total);
      }
    }),
  );
}, 100);

export const controlActions: Record<ControlAction, () => void | Promise<void>> =
  {
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
      setFinishedPlaylistSound(null);
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

      setPaused(newPaused);
      setSounds(
        produce((s) => {
          s.forEach((entry) => {
            entry.paused = newPaused;
          });
        }),
      );
    },
  };

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
  const id = await playSoundCmd(path, volumePct() / 100, soundPlaybackSpeed());
  if (id === undefined) return;

  registerSound(id, path, mode, soundPlaybackSpeed());
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

export const getProgress = (id: number) =>
  invoke<Progress | null>("get_progress", { id });

export const getMicVolume = () => invoke<number>("get_mic_volume");

export const setMicVolume = (volume: number) =>
  invoke("set_mic_volume", { volume });

export const setMicPitch = (semitones: number) =>
  invoke("set_mic_pitch", { semitones });

export const getMicPitch = () => invoke<number>("get_mic_pitch");

export const setPlaybackSpeed = (id: number, speed: number) =>
  invoke("set_playback_speed", { id, speed });

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

export function handleAllSoundPlaybackSpeedSlider(e: Event) {
  const value = parseFloat((e.currentTarget as HTMLInputElement).value);
  setSoundPlaybackSpeed(value);

  // Update registered sounds
  setSounds(
    produce((s) => {
      s.forEach((entry) => {
        entry.speed = value;
      });
    }),
  );

  // Update backend sounds
  for (const sound of sounds) {
    const latestId = sound.ids[sound.ids.length - 1];
    setPlaybackSpeed(latestId, value);
  }
}
