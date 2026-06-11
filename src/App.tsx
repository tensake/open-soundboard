import { invoke } from "@tauri-apps/api/core";
import { createSignal } from "solid-js";
import "./App.css";

const playSound = (path: string, volume: number) =>
  invoke<number>("play_sound", { path, volume });
const pauseSound = (id: number) => invoke("pause_sound", { id });
const resumeSound = (id: number) => invoke("resume_sound", { id });
const stopSound = (id: number) => invoke("stop_sound", { id });
const setVolume = (volume: number) => invoke("set_general_volume", { volume });
const stopAllSounds = () => invoke("stop_all_sounds");

const SOUNDS = [
  {
    label: "Sound 1",
    path: "/home/kitfc/Dev/open-soundboard/src/test_assets/sound1.mp3",
  },
  {
    label: "Sound 2",
    path: "/home/kitfc/Dev/open-soundboard/src/test_assets/sound2.mp3",
  },
];

export default function App() {
  const [volumePct, setVolumePct] = createSignal(100);
  const [activeId, setActiveId] = createSignal<number | null>(null);

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

  const handleVolume = (e: Event) => {
    const value = parseFloat((e.currentTarget as HTMLInputElement).value);
    setVolumePct(value);
    setVolume(value / 100);
  };

  return (
    <main class="container">
      <h1>SoundBoard</h1>
      <div class="buttons">
        <h2>Sounds</h2>

        {SOUNDS.map((s) => (
          <button onClick={() => handlePlay(s.path)}>{s.label}</button>
        ))}

        <h2>Controls</h2>
        <button onClick={handlePause}>Pause</button>
        <button onClick={handleResume}>Resume</button>
        <button onClick={handleStop}>Stop</button>
        <button onClick={() => stopAllSounds()}>Stop All</button>

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
      </div>
    </main>
  );
}
