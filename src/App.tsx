import { invoke } from "@tauri-apps/api/core";
import { createSignal, onCleanup } from "solid-js";
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

const SOUNDS = [
  {
    label: "Sound 1",
    path: "C:\\Users\\kitfc\\dev\\open-soundboard\\src\\test_assets\\sound1.mp3",
  },
  {
    label: "Sound 2 MP3",
    path: "C:\\Users\\kitfc\\dev\\open-soundboard\\src\\test_assets\\sound2.mp3",
  },
  {
    label: "Sound 3 WAV",
    path: "C:\\Users\\kitfc\\dev\\open-soundboard\\src\\test_assets\\sound3.wav",
  },
  {
    label: "Sound 4 FLAC",
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

  const handlePlay = async (path: string) => {
    const id = await playSound(path, volumePct() / 100);
    setActiveId(id);
  };

  const handlePause = () => {
    const id = activeId();
    if (id != null) pauseSound(id);
  };
  const handleResume = () => {
    const id = activeId();
    if (id != null) resumeSound(id);
  };
  const handleStop = () => {
    const id = activeId();
    if (id != null) stopSound(id);
  };
  const handleSeek = (e: Event) => {
    const value = parseFloat((e.currentTarget as HTMLInputElement).value);
    const id = activeId();
    if (id != null) seekSound(id, value);
  };

  const handleVolume = (e: Event) => {
    const value = parseFloat((e.currentTarget as HTMLInputElement).value);
    setVolumePct(value);
    setVolume(value / 100);
  };

  const interval = setInterval(async () => {
    const id = activeId();
    if (id == null) return;

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
    <main class="container">
      <h1>SoundBoard</h1>
      <div class="buttons">
        <h2>Sounds</h2>

        {SOUNDS.map((s) => (
          <button onClick={() => handlePlay(s.path)}>{s.label}</button>
        ))}

        <h2>Controls</h2>
        <h3>Buttons</h3>
        <button onClick={handlePause}>Pause</button>
        <button onClick={handleResume}>Resume</button>
        <button onClick={handleStop}>Stop</button>
        <button onClick={() => stopAllSounds()}>Stop All</button>

        <h3>Seek</h3>
        <input
          type="range"
          min="0"
          max={total()}
          step="1"
          value={current()}
          onInput={handleSeek}
        />
        <span>{formatTime(current())}</span>

        <h2>Volume</h2>
        <input
          type="range"
          min="0"
          max="100"
          step="1"
          value={volumePct()}
          onInput={handleVolume}
        />
        <span>{volumePct()}%</span>

        <h2>Progress</h2>
        <progress value={current()} max={total() || 1}></progress>
        <span>
          {formatTime(current())} / {formatTime(total())}
        </span>
      </div>
    </main>
  );
}
