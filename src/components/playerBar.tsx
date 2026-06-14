import type { Accessor, Setter } from "solid-js";
import { Show } from "solid-js";
import { Square, Pause, Play } from "lucide-solid";
import {
  pauseSound,
  resumeSound,
  seekSound,
  stopAllSounds,
  stopSound,
  formatTime,
  setGeneralVolume,
} from "../lib";

interface PlayerBarProps {
  activeId: Accessor<number | null>;
  setActiveId: Setter<number | null>;
  volumePct: Accessor<number>;
  setVolumePct: Setter<number>;
  paused: Accessor<boolean>;
  setPaused: Setter<boolean>;
  current: Accessor<number>;
  setCurrent: Setter<number>;
  total: Accessor<number>;
  setTotal: Setter<number>;
  seeking: Accessor<boolean>;
  setSeeking: Setter<boolean>;
}

export default function PlayerBar(props: PlayerBarProps) {
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

  const handleStopAll = () => {
    const id = props.activeId();
    if (id != null) stopSound(id);
    stopAllSounds();
    props.setActiveId(null);
    props.setCurrent(0);
    props.setTotal(0);
    props.setPaused(false);
  };

  const handleSeekInput = (e: Event) => {
    props.setCurrent(parseFloat((e.currentTarget as HTMLInputElement).value));
  };

  const handleSeekCommit = (e: Event) => {
    const value = parseFloat((e.currentTarget as HTMLInputElement).value);
    const id = props.activeId();
    props.setCurrent(value);
    if (id != null) seekSound(id, value);
    props.setSeeking(false);
  };

  const handleVolume = (e: Event) => {
    const value = parseFloat((e.currentTarget as HTMLInputElement).value);
    props.setVolumePct(value);
    setGeneralVolume(value / 100);
  };

  return (
    <div class="grid grid-cols-[0.3fr_1fr_0.3fr] gap-8 items-center border-t border-surface-1 pt-4 mt-4 min-h-24">
      <div />

      <div class="flex flex-col gap-2 items-center">
        <div class="flex gap-2">
          <button
            onClick={handlePauseResume}
            disabled={props.activeId() == null}
          >
            <Show when={props.paused()} fallback={<Pause class="w-5 h-5" />}>
              <Play class="w-5 h-5" />
            </Show>
          </button>
          <button onClick={handleStopAll} disabled={props.activeId() == null}>
            <Square class="w-5 h-5" />
          </button>
        </div>

        <div class="flex flex-row gap-2 items-center w-full">
          <span class="text-sm font-mono tabular-nums">
            {formatTime(props.current())}
          </span>
          <input
            type="range"
            min="0"
            max={props.total() > 0 ? props.total() : 1}
            step="0.1"
            value={props.current()}
            onPointerDown={() => props.setSeeking(true)}
            onInput={handleSeekInput}
            onChange={handleSeekCommit}
            class="flex-1 cursor-pointer"
            disabled={props.activeId() == null}
          />
          <span class="text-sm font-mono tabular-nums">
            {formatTime(props.total())}
          </span>
        </div>
      </div>

      <div class="flex flex-col gap-2 mx-4 max-w-xs">
        <input
          type="range"
          min="0"
          max="100"
          step="1"
          value={props.volumePct()}
          onInput={handleVolume}
          class="w-full cursor-pointer"
        />
      </div>
    </div>
  );
}
