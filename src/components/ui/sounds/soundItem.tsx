import { Show } from "solid-js";
import { Play, Keyboard, KeyboardOff, Clock } from "lucide-solid";
import { HotKeyEntry, SoundFile, readableBytes, readableDate, readableMilisecs } from "../../../lib";
import { waveform } from 'ldrs';
waveform.register();

export default function SoundItem(props: {
  isPlaying: boolean;
  isRecent: boolean;
  sound: SoundFile;
  odd: boolean;
  registered: HotKeyEntry | undefined;
  onPlay: () => void;
  onStartCapture: () => void;
  onUnregister: (e: MouseEvent) => void | Promise<void>;
}) {
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
          <Show
            when={props.isRecent}
            fallback={<Idle />}
          >
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

      {/* Metadata */}
      <div class="flex items-center gap-3 text-xs text-subtext-0 truncate shrink-0">
        <span class="w-32 text-right">{readableDate(props.sound.datetime)}</span>
        <span class="w-16 text-right">{readableBytes(props.sound.size)}</span>
        <span class="w-8 text-right">{readableMilisecs(props.sound.duration)}</span>
      </div>

      {/* Register/Unregister button */}
      <Show
        when={props.registered}
        fallback={
          <div
            class="opacity-0 group-hover:opacity-100 hover:text-blue transition-opacity shrink-0"
            onClick={(e) => { e.stopPropagation(); props.onStartCapture(); }}
            title="Click to register hotkey"
          >
            <Keyboard class="w-3.5 h-3.5" />
          </div>
        }
      >
        {(_) => (
          <div
            class="opacity-0 group-hover:opacity-100 hover:text-red transition-opacity shrink-0"
            onClick={(e) => { e.stopPropagation(); props.onUnregister(e); }}
            title="Click to unregister hotkey"
          >
            <KeyboardOff class="w-3.5 h-3.5" />
          </div>
        )}
      </Show>
    </div>
  );
}
