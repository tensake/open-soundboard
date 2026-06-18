import { Show, createEffect, onCleanup } from "solid-js";
import { Keyboard } from "lucide-solid";

interface HotkeyOverlayProps {
  capturingFor: string | null;
  onCapture: (binding: string) => void;
  onCancel: () => void;
}

function buildBinding(e: KeyboardEvent): string {
  const parts: string[] = [];

  // Add modifiers
  if (e.ctrlKey) parts.push("Ctrl");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");
  if (e.metaKey) parts.push("Super");
  const key = e.key;

  // Skip bare modifier keys
  if (["Control", "Alt", "Shift", "Meta"].includes(key)) return "";

  // Normalize key names
  const keyMap: Record<string, string> = {
    " ": "Space",
    ArrowUp: "Up",
    ArrowDown: "Down",
    ArrowLeft: "Left",
    ArrowRight: "Right",
  };

  parts.push(keyMap[key] ?? (key.length === 1 ? key.toUpperCase() : key));
  return parts.join("+");
}

export default function HotkeyOverlay(props: HotkeyOverlayProps) {
  createEffect(() => {
    if (!props.capturingFor) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        props.onCancel();
        return;
      }

      const binding = buildBinding(e);
      if (!binding) return;

      e.preventDefault();
      props.onCapture(binding);
    };

    window.addEventListener("keydown", handleKeyDown);
    onCleanup(() => window.removeEventListener("keydown", handleKeyDown));
  });

  return (
    <Show when={props.capturingFor}>
      <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        onClick={() => props.onCancel()}
      >
        <div
          class="bg-surface-0 rounded-lg p-8 flex flex-col items-center gap-2 shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <Keyboard class="w-8 h-8 text-blue" />
          <p class="text-text font-medium">Press a key combination</p>
          <p class="text-subtext-0 text-sm truncate max-w-xs">
            {props.capturingFor!.split(/[\\/]/).pop()}
          </p>
          <p class="text-subtext-1 pt-2 text-xs">Click Escape to cancel</p>
        </div>
      </div>
    </Show>
  );
}
