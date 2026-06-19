import { For, Show, createSignal } from "solid-js";
import { Pause, Play, Square } from "lucide-solid";
import { TransitionGroup } from "solid-transition-group";
import {
  sounds,
  handlePauseResume,
  handleStop,
  handleSeekCommit,
  formatTime,
  SoundEntry,
} from "../../../lib";

function SoundRow(props: { path: string; sounds: SoundEntry[] }) {
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
      <span class="text-sm truncate w-48 shrink-0">
        <Show when={entry().count > 1}>
          <span class="text-subtext-0 mr-1">{entry().count}x</span>
        </Show>
        {name()}
      </span>

      <div
        class="shrink-0 hover:text-blue transition-colors cursor-pointer"
        onClick={() => handlePauseResume(entry())}
      >
        <Show when={entry().paused} fallback={<Pause class="w-4 h-4" />}>
          <Play class="w-4 h-4" />
        </Show>
      </div>
      <div
        class="shrink-0 hover:text-red transition-colors cursor-pointer"
        onClick={() => handleStop(entry())}
      >
        <Square class="w-4 h-4" />
      </div>

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
          handleSeekCommit(entry(), parseFloat(e.currentTarget.value));
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

export default function SoundsList() {
  const reversedPaths = () => [...sounds].map((s) => s.path).reverse();

  return (
    <div class="max-h-[40vh] overflow-y-auto border-t border-surface-0 bg-mantle">
      <TransitionGroup
        enterActiveClass="slide-down-enter-active"
        enterClass="slide-down-enter"
        enterToClass="slide-down-enter-to"
        exitActiveClass="slide-up-exit-active"
        exitClass="slide-up-exit"
        exitToClass="slide-up-exit-to"
        appear
      >
        <For each={reversedPaths()} fallback={null}>
          {(path) => <SoundRow path={path} sounds={sounds} />}
        </For>
      </TransitionGroup>
    </div>
  );
}
