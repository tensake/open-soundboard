import { For, Show } from "solid-js";
import type { Accessor, Setter } from "solid-js";
import { Play, Square, Pause } from "lucide-solid";
import {
  playSound,
  stopAllSounds,
  pauseSound,
  resumeSound,
  setGeneralVolume,
} from "../lib";
import { SOUNDS } from "../types";

interface DashboardProps {
  activeId: Accessor<number | null>;
  setActiveId: Setter<number | null>;
  volumePct: Accessor<number>;
  setVolumePct: Setter<number>;
  paused: Accessor<boolean>;
  setPaused: Setter<boolean>;
  current: Accessor<number>;
  total: Accessor<number>;
}

export default function Dashboard(props: DashboardProps) {
  const handlePlay = async (path: string) => {
    const id = await playSound(path, props.volumePct() / 100);
    props.setActiveId(id);
    props.setPaused(false);
  };

  const handlePauseResume = () => {
    const id = props.activeId();
    if (id === null) return;
    if (!props.paused()) {
      pauseSound(id);
      props.setPaused(true);
    } else {
      resumeSound(id);
      props.setPaused(false);
    }
  };

  const handleVolume = (e: Event) => {
    const value = parseFloat((e.currentTarget as HTMLInputElement).value);
    props.setVolumePct(value);
    setGeneralVolume(value / 100);
  };

  return (
    <div class="grid grid-cols-[1fr_0.5fr] gap-4 h-full">
      <div class="flex flex-col gap-4">
        <div class="flex gap-2">
          <button
            class="p-2 border rounded hover:bg-muted"
            onClick={handlePauseResume}
          >
            <Show when={props.paused()} fallback={<Pause class="w-5 h-5" />}>
              <Play class="w-5 h-5" />
            </Show>
          </button>
          <button
            class="p-2 border rounded hover:bg-muted"
            onClick={() => stopAllSounds()}
          >
            <Square class="w-5 h-5" />
          </button>
        </div>

        <hr />

        <div>
          <h2 class="text-xl font-semibold mb-2">Sounds</h2>
          <div class="flex flex-col gap-2">
            <For each={SOUNDS}>
              {(s) => (
                <button
                  class="flex items-center gap-2 p-2 border rounded hover:bg-muted"
                  onClick={() => handlePlay(s.path)}
                >
                  <Play class="w-4 h-4 fill-current" />
                  {s.label}
                </button>
              )}
            </For>
          </div>
        </div>
      </div>

      <div class="flex flex-col gap-2">
        <h2 class="text-lg font-medium">General Volume</h2>
        <input
          type="range"
          min="0"
          max="100"
          step="1"
          value={props.volumePct()}
          onInput={handleVolume}
          class="w-full cursor-pointer"
        />
        <span class="text-sm font-mono">{props.volumePct()}%</span>
      </div>
    </div>
  );
}
