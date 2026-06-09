import { invoke } from "@tauri-apps/api/core";
import "./App.css";

const play = (path: string) => invoke("play_sound", { path });
const pause = (id: number) => invoke("pause_sound", { id });
const resume = (id: number) => invoke("resume_sound", { id });
const stop = (id: number) => invoke("stop_sound", { id });
const stopAll = () => invoke("stop_all_sounds");

export default function App() {
  return (
    <main class="container">
      <h1>SoundBoard</h1>
      <div class="buttons">
        <button
          onClick={() =>
            play(
              "C:/Users/kitfc/dev/open-soundboard/src/test_assets/sound1.mp3",
            )
          }
        >
          Play Sound 1
        </button>
        <button
          onClick={() =>
            play(
              "C:/Users/kitfc/dev/open-soundboard/src/test_assets/sound2.mp3",
            )
          }
        >
          Play Sound 2
        </button>
        <button onClick={() => pause(1)}>Pause Sound 1</button>
        <button onClick={() => resume(1)}>Resume Sound 1</button>
        <button onClick={() => stop(1)}>Stop Sound 1</button>
        <button onClick={() => stopAll()}>Stop All Sounds</button>
      </div>
    </main>
  );
}
