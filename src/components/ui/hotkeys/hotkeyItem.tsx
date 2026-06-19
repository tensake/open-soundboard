import { HotKeyEntry } from "../../../lib";
import { Trash2 } from "lucide-solid";
import { unregisterHotkey } from "../../../lib/hotkey";

export default function HotKeyItem(props: {
  hotkey: HotKeyEntry;
  disabled: boolean;
  onStartCapture: (hotkey: HotKeyEntry) => void;
}) {
  return (
    <div class="flex items-center justify-between gap-4 px-3 py-2 rounded-md transition-all bg-surface-0 hover:bg-surface-1">
      {/* Unregister button */}
      <div class="flex items-center gap-3 min-w-0 flex-1">
        <button
          onClick={async (_) => {
            await unregisterHotkey(props.hotkey.id);
          }}
          disabled={props.disabled}
          class="disabled:opacity-30 disabled:cursor-not-allowed text-text"
          title="Unregister hotkey"
        >
          <Trash2 class="w-3.5 h-3.5" />
        </button>

        {/* Context */}
        <div class="flex flex-col min-w-0">
          <span class="text-sm font-medium text-text truncate">
            {props.hotkey.context.split(/[\\/]/).pop()}
          </span>
          <span class="text-xs text-subtext-1">{props.hotkey.kind}</span>
        </div>
      </div>

      {/* Binding */}
      <div class="shrink-0">
        <kbd
          class="px-2 py-1 text-xs bg-mantle text-primary-400 rounded cursor-pointer select-none"
          onClick={() => props.onStartCapture(props.hotkey)}
        >
          {props.hotkey.binding}
        </kbd>
      </div>
    </div>
  );
}
