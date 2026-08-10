import { Show } from "solid-js";
import { Heart, Pin, Keyboard, KeyboardOff, Trash } from "lucide-solid";
import type { HotKeyEntry, SoundConfig, SoundTab } from "../../../lib";

export default function HoverMenu(props: {
  currentTab: SoundTab | null;
  soundConfig: SoundConfig | null;
  registered: HotKeyEntry | undefined;
  onToggleFavourite: () => void;
  onTogglePin: () => void;
  onStartCapture: () => void;
  onUnregister: (e: MouseEvent) => void | Promise<void>;
  onRemove: () => void;
}) {
  const isFavourite = () => props.soundConfig?.tags.includes("favourite") ?? false;
  const isPinned = () => props.currentTab
      ? (props.soundConfig?.pins.includes(props.currentTab.id) ?? false)
      : false;

  return (
    <div class="mx-1 flex items-center gap-2">
      {/* Remove from tab */}
      <Show when={props.currentTab?.kind === "user"}>
        <div
          class="hover-menu-item text-subtext-0 hover:text-primary-400 transition-colors"
          onClick={(e) => { e.stopPropagation(); props.onRemove?.(); }}
          title="Remove from tab"
        >
          <Trash class="w-3.5 h-3.5" />
        </div>
      </Show>

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
            class="hover-menu-item text-subtext-0 hover:text-primary-400 transition-colors"
            onClick={(e) => { e.stopPropagation(); props.onStartCapture(); }}
            title="Set hotkey"
          >
            <Keyboard class="w-4 h-4" />
          </div>
        }
      >
        {(_) => (
          <div
            class="hover-menu-item text-subtext-0 hover:text-primary-400 transition-colors"
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
