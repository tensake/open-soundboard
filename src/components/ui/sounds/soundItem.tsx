import { Show } from "solid-js";
import { Play, Keyboard, KeyboardOff } from "lucide-solid";
import { HotKeyEntry, SoundFile, readableBytes, readableDate } from "../../../lib";

export default function SoundItem(props: {
  sound: SoundFile;
  odd: boolean;
  registered: HotKeyEntry | undefined;
  onPlay: () => void;
  onStartCapture: () => void;
  onUnregister: (e: MouseEvent) => void | Promise<void>;
}) {
  return (
    <div
      class={`group flex items-center gap-2 px-3 py-1 cursor-pointer transition-colors border-l border-surface-0 ${
        props.odd ? "bg-(--background-color)" : "bg-mantle"
      } hover:bg-surface-0 hover:text-primary-400`}
      onClick={props.onPlay}
    >
      {/* Name */}
      <Play class="w-3 h-3 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
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
