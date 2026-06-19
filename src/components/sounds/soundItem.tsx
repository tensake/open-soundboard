import { Show } from "solid-js";
import { Play, Keyboard, KeyboardOff } from "lucide-solid";
import { HotKeyEntry } from "../../lib";

export default function SoundItem(props: {
  sound: string;
  odd: boolean;
  registered: HotKeyEntry | undefined;
  onPlay: () => void;
  onStartCapture: () => void;
  onUnregister: (e: MouseEvent) => void | Promise<void>;
}) {
  return (
    <div
      class={`group flex items-center gap-2 px-3 py-1 cursor-pointer transition-colors ${
        props.odd ? "bg-base" : "bg-mantle"
      } hover:bg-surface-0 hover:text-primary-400`}
      onClick={props.onPlay}
    >
      {/* Name */}
      <Play class="w-3 h-3 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
      <span class="text-sm truncate flex-1">
        {props.sound.split(/[\\/]/).pop()}
      </span>

      {/* Register/Unregister button */}
      <Show
        when={props.registered}
        fallback={
          <div
            class="opacity-0 group-hover:opacity-100 hover:text-blue transition-opacity ml-auto shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              props.onStartCapture();
            }}
            title="Click to register hotkey"
          >
            <Keyboard class="w-3.5 h-3.5" />
          </div>
        }
      >
        {(hk) => (
          <div
            class="opacity-0 group-hover:opacity-100 hover:text-red transition-opacity ml-auto shrink-0 flex items-center gap-1"
            onClick={(e) => {
              e.stopPropagation();
              props.onUnregister(e);
            }}
            title="Click to unregister hotkey"
          >
            <span class="text-xs text-subtext-0">{hk().binding}</span>
            <KeyboardOff class="w-3.5 h-3.5" />
          </div>
        )}
      </Show>
    </div>
  );
}
