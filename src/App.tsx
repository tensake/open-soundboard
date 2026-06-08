import { invoke } from "@tauri-apps/api/core";
import "./App.css";

const play = (path: string) => invoke("play_sound", { path });

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
      </div>
    </main>
  );
}
