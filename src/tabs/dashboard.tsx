import { For } from "solid-js";
import type { Accessor, Setter } from "solid-js";
import { Play } from "lucide-solid";
import { playSound } from "../lib";
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

  return (
    <div class="gap-4 h-full">
      <div class="flex flex-col gap-4">
        <div>
          <h2 class="text-xl font-semibold mb-2">Sounds</h2>
          <div class="flex flex-col gap-2">
            <For each={SOUNDS}>
              {(s) => (
                <button
                  class="flex items-center gap-2 p-2 border rounded hover:bg-muted w-32"
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
    </div>
  );
}
