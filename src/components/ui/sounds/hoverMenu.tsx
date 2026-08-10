import { Show } from "solid-js";
import { Heart, Pin, Keyboard, KeyboardOff } from "lucide-solid";
import type { HotKeyEntry, SoundConfig } from "../../../lib";

export default function HoverMenu(props: {
  currentTabId: string | undefined;
  soundConfig: SoundConfig | null;
  registered: HotKeyEntry | undefined;
  onToggleFavourite: () => void;
  onTogglePin: () => void;
  onStartCapture: () => void;
  onUnregister: (e: MouseEvent) => void | Promise<void>;
}) {
  const isFavourite = () => props.soundConfig?.tags.includes("favourite") ?? false;
  const isPinned = () => props.soundConfig?.pins.includes(props.currentTabId ?? "") ?? false;

  return (
    <div class="mx-1 flex items-center gap-2">
      {/* Favourite */}
      <div
        class={`hover-menu-item transition-colors ${isFavourite() ? "text-primary-400" : "text-subtext-0 hover:text-primary-400"}`}
        onClick={(e) => { e.stopPropagation(); props.onToggleFavourite(); }}
        title={isFavourite() ? "Remove from favourites" : "Add to favourites"}
      >
        <Heart class="w-4 h-4" fill={isFavourite() ? "currentColor" : "none"} />
      </div>

      {/* Pin */}
      <div
        class={`hover-menu-item transition-colors ${isPinned() ? "text-primary-400" : "text-subtext-0 hover:text-primary-400"}`}
        onClick={(e) => { e.stopPropagation(); props.onTogglePin(); }}
        title={isPinned() ? "Unpin sound" : "Pin to top"}
      >
        <Pin class="w-4 h-4" fill={isPinned() ? "currentColor" : "none"} />
      </div>

      {/* Set hotkey */}
      <Show
        when={props.registered}
        fallback={
          <div
            class="hover-menu-item text-subtext-0 hover:text-blue transition-colors"
            onClick={(e) => { e.stopPropagation(); props.onStartCapture(); }}
            title="Set hotkey"
          >
            <Keyboard class="w-4 h-4" />
          </div>
        }
      >
        {(_) => (
          <div
            class="hover-menu-item text-subtext-0 hover:text-red transition-colors"
            onClick={(e) => { e.stopPropagation(); props.onUnregister(e); }}
            title="Remove hotkey"
          >
            <KeyboardOff class="w-4 h-4" />
          </div>
        )}
      </Show>
    </div>
  );
}
