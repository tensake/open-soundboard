import { invoke } from "@tauri-apps/api/core";
import { createSignal, onCleanup, onMount, Show } from "solid-js";
import { Play, Square, Pause } from "lucide-solid";
import "./App.css";

const playSound = (path: string, volume: number) =>
  invoke<number>("play_sound", { path, volume });
const pauseSound = (id: number) => invoke("pause_sound", { id });
const resumeSound = (id: number) => invoke("resume_sound", { id });
const stopSound = (id: number) => invoke("stop_sound", { id });
const seekSound = (id: number, secs: number) =>
  invoke("seek_sound", { id, secs });
const setVolume = (volume: number) => invoke("set_general_volume", { volume });
const stopAllSounds = () => invoke("stop_all_sounds");
const getProgress = (id: number) =>
  invoke<{ current: number; total: number } | null>("get_progress", { id });
const getMicVolume = () => invoke<number>("get_mic_volume");
const setMicVolume = (volume: number) => invoke("set_mic_volume", { volume });

const SOUNDS = [
  {
    label: "Sound 1",
    path: "C:\\Users\\kitfc\\dev\\open-soundboard\\src\\test_assets\\sound1.mp3",
  },
  {
    label: "Sound 2",
    path: "C:\\Users\\kitfc\\dev\\open-soundboard\\src\\test_assets\\sound2.mp3",
  },
  {
    label: "Sound 3",
    path: "C:\\Users\\kitfc\\dev\\open-soundboard\\src\\test_assets\\sound3.wav",
  },
  {
    label: "Sound 4",
    path: "C:\\Users\\kitfc\\dev\\open-soundboard\\src\\test_assets\\sound4.flac",
  },
];

function formatTime(secs: number): string {
  if (!isFinite(secs) || secs < 0) return "0:00";
  return `${Math.floor(secs / 60)}:${Math.floor(secs % 60)
    .toString()
    .padStart(2, "0")}`;
}

export default function App() {
  const [volumePct, setVolumePct] = createSignal(100);
  const [activeId, setActiveId] = createSignal<number | null>(null);

  const [current, setCurrent] = createSignal(0);
  const [total, setTotal] = createSignal(0);
  const [seeking, setSeeking] = createSignal(false);
  const [paused, setPaused] = createSignal(false);

  const [micVolumePct, setMicVolumePct] = createSignal(100);

  const handlePlay = async (path: string) => {
    const id = await playSound(path, volumePct() / 100);
    setActiveId(id);
  };

  const handlePause = () => {
    const id = activeId();
    if (id === null) return;
    if (!paused()) {
      pauseSound(id);
      setPaused(true);
    } else {
      resumeSound(id);
      setPaused(false);
    }
  };

  const handleSeekInput = (e: Event) => {
    const value = parseFloat((e.currentTarget as HTMLInputElement).value);
    setCurrent(value);
  };

  const handleSeek = (e: Event) => {
    const value = parseFloat((e.currentTarget as HTMLInputElement).value);
    const id = activeId();
    setCurrent(value);
    if (id != null) seekSound(id, value);
    setSeeking(false);
  };

  const handleVolume = (e: Event) => {
    const value = parseFloat((e.currentTarget as HTMLInputElement).value);
    setVolumePct(value);
    setVolume(value / 100);
  };

  const handleMicVolume = (e: Event) => {
    const value = parseFloat((e.currentTarget as HTMLInputElement).value);
    setMicVolumePct(value);
    setMicVolume(value / 100);
  };

  onMount(async () => {
    const micVol = await getMicVolume();
    setMicVolumePct(Math.round(micVol * 100));
  });

  const interval = setInterval(async () => {
    const id = activeId();
    if (id == null) return;
    if (seeking()) return;

    const progress = await getProgress(id);
    if (progress) {
      setCurrent(progress.current);
      setTotal(progress.total);
    } else {
      setCurrent(0);
      setTotal(0);
      setActiveId(null);
    }
  }, 100);

  onCleanup(() => clearInterval(interval));

  return (
    <main class="flex flex-col justify-between gap-4 p-4 h-screen">
      <div class="grid grid-cols-[1fr_0.5fr] gap-4">
        <div class="flex flex-col">
          <div class="flex gap-1">
            <button onClick={handlePause}>
              <Show when={paused()} fallback={<Pause />}>
                <Play />
              </Show>
            </button>
            <button onClick={() => stopAllSounds()}>
              <Square />
            </button>
          </div>
          <hr />
          <h2>Sounds</h2>
          <div class="flex gap-1">
            {SOUNDS.map((s) => (
              <button onClick={() => handlePlay(s.path)}>
                <Play />
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <div class="flex flex-col">
          <h2>General Volume</h2>
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            value={volumePct()}
            onInput={handleVolume}
          />
          <span>{volumePct()}%</span>
          <h2>Microphone Volume</h2>
          <input
            type="range"
            min="0"
            max="300"
            step="1"
            value={micVolumePct()}
            onInput={handleMicVolume}
          />
          <span>{micVolumePct()}%</span>
        </div>
      </div>
      <div class="progress flex flex-col gap-1 items-center">
        <span>
          {formatTime(current())} / {formatTime(total())}
        </span>
        <input
          type="range"
          min="0"
          max={total() || 1}
          step="1"
          value={current()}
          onPointerDown={() => setSeeking(true)}
          onInput={handleSeekInput}
          onChange={handleSeek}
        />
      </div>
    </main>
  );
}
