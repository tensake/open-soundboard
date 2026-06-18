import { createSignal, For, onCleanup, Show } from "solid-js";
import { createStore, produce } from "solid-js/store";
import { Pause, Play, Square } from "lucide-solid";
import {
  pauseSound,
  resumeSound,
  seekSound,
  stopSound,
  getProgress,
  formatTime,
} from "../../lib";

interface SoundEntry {
  ids: number[];
  path: string;
  current: number;
  total: number;
  paused: boolean;
  count: number;
}

interface SoundRowProps {
  path: string;
  sounds: SoundEntry[];
  onPauseResume: (entry: SoundEntry) => void;
  onStop: (entry: SoundEntry) => void;
  onSeekCommit: (entry: SoundEntry, value: number) => void;
}

function SoundRow(props: SoundRowProps) {
  const entry = () => props.sounds.find((s) => s.path === props.path)!;

  const [seeking, setSeeking] = createSignal(false);
  const [localCurrent, setLocalCurrent] = createSignal(0);

  const displayCurrent = () => (seeking() ? localCurrent() : entry().current);
  const name = () =>
    entry().path
      ? (entry().path.split(/[\\/]/).pop() ?? entry().path)
      : `Sound ${entry().ids[0]}`;

  return (
    <div class="flex items-center gap-3 px-4 py-2 border-b border-surface-0 last:border-b-0">
      {/* Name and count */}
      <span class="text-sm truncate w-48 shrink-0">
        <Show when={entry().count > 1}>
          <span class="text-subtext-0 mr-1">{entry().count}x</span>
        </Show>
        {name()}
      </span>

      {/* Buttons */}
      <div
        class="shrink-0 hover:text-blue transition-colors cursor-pointer"
        onClick={() => props.onPauseResume(entry())}
      >
        <Show when={entry().paused} fallback={<Pause class="w-4 h-4" />}>
          <Play class="w-4 h-4" />
        </Show>
      </div>
      <div
        class="shrink-0 hover:text-red transition-colors cursor-pointer"
        onClick={() => props.onStop(entry())}
      >
        <Square class="w-4 h-4" />
      </div>

      {/* Progress bar */}
      <span class="text-xs font-mono tabular-nums shrink-0 text-subtext-0 select-none">
        {formatTime(displayCurrent())}
      </span>
      <input
        type="range"
        min="0"
        max={entry().total > 0 ? entry().total : 1}
        step="0.1"
        value={displayCurrent()}
        onPointerDown={() => {
          setSeeking(true);
          setLocalCurrent(entry().current);
        }}
        onInput={(e) => setLocalCurrent(parseFloat(e.currentTarget.value))}
        onChange={(e) => {
          props.onSeekCommit(entry(), parseFloat(e.currentTarget.value));
          setSeeking(false);
        }}
        class="flex-1 cursor-pointer"
      />
      <span class="text-xs font-mono tabular-nums shrink-0 text-subtext-0 select-none">
        {formatTime(entry().total)}
      </span>
    </div>
  );
}

interface SoundsListProps {
  onSoundAdded: (register: (id: number, path: string) => void) => void;
}

export default function SoundsList(props: SoundsListProps) {
  const [sounds, setSounds] = createStore<SoundEntry[]>([]);

  const addSound = (id: number, path: string) => {
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
  };

  props.onSoundAdded(addSound);

  const removeSound = (path: string) =>
    setSounds(
      produce((s) => {
        const i = s.findIndex((e) => e.path === path);
        if (i !== -1) s.splice(i, 1);
      }),
    );

  const handlePauseResume = (entry: SoundEntry) => {
    const i = sounds.findIndex((s) => s.path === entry.path);
    if (i === -1) return;

    entry.ids.forEach((id) =>
      entry.paused ? resumeSound(id) : pauseSound(id),
    );
    setSounds(i, "paused", !entry.paused);
  };

  const handleStop = (entry: SoundEntry) => {
    entry.ids.forEach((id) => stopSound(id));
    removeSound(entry.path);
  };

  const handleSeekCommit = (entry: SoundEntry, value: number) => {
    const latestId = entry.ids[entry.ids.length - 1];
    seekSound(latestId, value);
    const i = sounds.findIndex((s) => s.path === entry.path);
    if (i !== -1) setSounds(i, "current", value);
  };

  const interval = setInterval(async () => {
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

  onCleanup(() => clearInterval(interval));

  const reversedPaths = () => [...sounds].map((s) => s.path).reverse();

  return (
    <div class="max-h-[40vh] overflow-y-auto border-t border-surface-0 bg-mantle">
      <For each={reversedPaths()} fallback={null}>
        {(path) => (
          <SoundRow
            path={path}
            sounds={sounds}
            onPauseResume={handlePauseResume}
            onStop={handleStop}
            onSeekCommit={handleSeekCommit}
          />
        )}
      </For>
    </div>
  );
}
