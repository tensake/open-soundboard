import { Show, createSignal } from "solid-js";
import { Play, Clock } from "lucide-solid";
import { readableBytes, readableDate, readableMilisecs } from "../../../lib";
import type { HotKeyEntry, SoundConfig, Tab, SoundFile } from "../../../bindings";
import HoverMenu from "./hoverMenu";
import { waveform } from 'ldrs';
waveform.register();

interface SoundItemProps {
  currentTab: Tab | null ;
  isPlaying: boolean;
  isRecent: boolean;
  sound: SoundFile;
  odd: boolean;
  registered: HotKeyEntry | undefined;
  soundConfig: SoundConfig | null;
  onPlay: () => void;
  onStartCapture: () => void;
  onUnregister: (e: MouseEvent) => void | Promise<void>;
  onToggleFavourite: () => void;
  onTogglePin: () => void;
  onRemove: () => void;
}

export default function SoundItem(props: SoundItemProps) {
  const [hovered, setHovered] = createSignal(false);

  const Playing = () => (
    <l-waveform size="12" color="var(--color-primary-400)" stroke={2} />
  );

  const Recent = () => (
    <Clock class="w-3 h-3 inline-block" />
  );

  const Idle = () => (
    <Play class="w-3 h-3 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
  );

  return (
    <div
      class={`group flex items-center gap-2 px-3 py-1 cursor-pointer transition-colors border-l border-surface-0 ${
        props.odd ? "bg-(--background-color)" : "bg-mantle"
      } hover:bg-surface-0 hover:text-primary-400`}
      onClick={props.onPlay}
    >
      {/* Name */}
      <Show
        when={props.isPlaying}
        fallback={
          <Show when={props.isRecent} fallback={<Idle />}>
            <Recent />
          </Show>
        }
      >
        <Playing />
      </Show>
      <span class="text-sm truncate flex-1">
        {props.sound.path.split(/[\\/]/).pop()}
      </span>

      {/* Binding */}
      <Show when={props.registered}>
        {(hk) => (
          <span class="text-xs text-subtext-0 shrink-0">{hk().binding}</span>
        )}
      </Show>

      {/* Metadata and hover menu */}
      <div class="relative flex items-center shrink-0 overflow-hidden -my-1 py-1"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Metadata */}
        <div
          class={`flex items-center gap-3 text-xs text-subtext-0 transition-all duration-200 ${
            hovered() ? "opacity-0 translate-x-4 pointer-events-none" : "opacity-100 translate-x-0"
          }`}
        >
          <span class="w-32 text-right">{readableDate(props.sound.datetime)}</span>
          <span class="w-16 text-right">{readableBytes(props.sound.size)}</span>
          <span class="w-8 text-right">{readableMilisecs(props.sound.duration)}</span>
        </div>

        {/* Hover menu */}
        <div
          class={`absolute right-0 flex items-center transition-all duration-200 ${
            hovered() ? "opacity-100 translate-x-0" : "opacity-0 translate-x-4 pointer-events-none"
          }`}
        >
          <HoverMenu
            currentTab={props.currentTab}
            soundConfig={props.soundConfig}
            registered={props.registered}
            onToggleFavourite={props.onToggleFavourite}
            onTogglePin={() => { setHovered(false); props.onTogglePin(); }}
            onStartCapture={props.onStartCapture}
            onUnregister={props.onUnregister}
            onRemove={props.onRemove}
          />
        </div>
      </div>
    </div>
  );
}
