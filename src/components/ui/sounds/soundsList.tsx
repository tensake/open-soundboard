import { For, Show, createSignal } from "solid-js";
import { Pause, Play, Square, Repeat, Shuffle } from "lucide-solid";
import { TransitionGroup } from "solid-transition-group";
import {
  sounds,
  handlePauseResume,
  handleStop,
  handleSeekCommit,
  nextSoundPlaylistMode,
  formatTime,
  SoundEntry,
} from "../../../lib";
import ProgressSlider from "../progressSlider";

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
      <span class="text-sm truncate w-56 shrink-0 flex items-center gap-1.5">
        {/* Name */}
        <span class="truncate">
          <Show when={entry().count > 1}>
            <span class="text-subtext-0 mr-1">{entry().count}x</span>
          </Show>
          {name()}
        </span>
      </span>

      {/* Controls */}
      <div
        class={`shrink-0 cursor-pointer transition-colors ${
          entry().playlistMode === "disabled"
            ? "text-subtext-0"
            : "text-primary-400"
        }`}
        onClick={(e) => {
          e.stopPropagation();
          nextSoundPlaylistMode(entry().path);
        }}
        title={`Playlist: ${entry().playlistMode}`}
      >
        <Show
          when={entry().playlistMode === "shuffle"}
          fallback={<Repeat class="w-3.5 h-3.5" />}
        >
          <Shuffle class="w-3.5 h-3.5" />
        </Show>
      </div>

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
      <ProgressSlider
        value={displayCurrent()}
        min={0}
        max={entry().total > 0 ? entry().total : 1}
        step={0.1}
        onChange={(v) => setLocalCurrent(v)}
        inputProps={{
          onPointerDown: () => {
            setSeeking(true);
            setLocalCurrent(entry().current);
          },
          onChange: (e) => {
            handleSeekCommit(entry(), parseFloat(e.currentTarget.value));
            setSeeking(false);
          },
        }}
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
