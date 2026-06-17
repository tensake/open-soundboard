import {
  createEffect,
  createResource,
  createSignal,
  For,
  Show,
} from "solid-js";
import type { Accessor, Setter } from "solid-js";
import { Play, Plus, Trash2, Keyboard, KeyboardOff } from "lucide-solid";
import { open } from "@tauri-apps/plugin-dialog";
import {
  getTabs,
  addTab,
  removeTab,
  getHotkeys,
  registerHotkey,
  unregisterHotkey,
} from "../../lib";
import type { HotKeyEntry } from "../../lib";
import { SoundTab } from "../../types";

interface DashboardProps {
  handlePlaySound: (path: string) => void | Promise<void>;
  volumePct: Accessor<number>;
  setVolumePct: Setter<number>;
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

function SoundItem(props: {
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

export default function Dashboard(props: DashboardProps) {
  const [tabs, { refetch }] = createResource(getTabs);
  const [hotkeys, { refetch: refetchHotkeys }] = createResource(getHotkeys);
  const [currentTab, setCurrentTab] = createSignal<[SoundTab, string[]] | null>(
    null,
  );
  const [capturingFor, setCapturingFor] = createSignal<string | null>(null);

  let captureListener: ((e: KeyboardEvent) => void) | null = null;

  createEffect(() => {
    const loadedTabs = tabs();
    if (!currentTab() && loadedTabs?.length) {
      setCurrentTab(loadedTabs[0]);
    }
  });

  const findHotkeyForSound = (path: string): HotKeyEntry | undefined =>
    hotkeys()?.find((hk) => hk.context === path);

  const handleAddTab = async () => {
    const selected = await open({ directory: true, multiple: false });
    if (!selected) return;
    const name = selected.split(/[\\/]/).pop() ?? selected;
    await addTab(name, selected);
    refetch();
  };

  const handleRemoveTab = async (id: string) => {
    await removeTab(id);
    refetch();
  };

  const cancelCapture = () => {
    setCapturingFor(null);

    if (captureListener) {
      window.removeEventListener("keydown", captureListener);
      captureListener = null;
    }
  };

  const handleStartCapture = (path: string) => {
    setCapturingFor(path);

    captureListener = (e: KeyboardEvent) => {
      // Cancel capture if escape is pressed
      if (e.key === "Escape") {
        cancelCapture();
        return;
      }

      const binding = buildBinding(e);
      if (!binding) return;

      e.preventDefault();
      cancelCapture();

      // Register hotkey
      const hk: HotKeyEntry = {
        id: crypto.randomUUID(),
        binding,
        kind: "Sound",
        context: path,
      };
      registerHotkey(hk).then(() => refetchHotkeys());
    };

    window.addEventListener("keydown", captureListener);
  };

  const handleUnregister = async (e: MouseEvent, path: string) => {
    e.stopPropagation();
    const hk = findHotkeyForSound(path);
    if (!hk) return;
    await unregisterHotkey(hk.id);
    refetchHotkeys();
  };

  const isCurrentTab = (tab: SoundTab) => currentTab()?.[0].id === tab.id;

  return (
    <div class="flex flex-col h-full overflow-hidden">
      {/* Hotkey capture overlay */}
      <Show when={capturingFor()}>
        <div
          class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={cancelCapture}
        >
          <div
            class="bg-surface-0 rounded-lg p-8 flex flex-col items-center gap-2 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <Keyboard class="w-8 h-8 text-blue" />
            <p class="text-text font-medium">Press a key combination</p>
            <p class="text-subtext-0 text-sm truncate max-w-xs">
              {capturingFor()!.split(/[\\/]/).pop()}
            </p>
            <p class="text-subtext-1 pt-2 text-xs">Click Escape to cancel</p>
          </div>
        </div>
      </Show>

      {/* Tabs */}
      <div class="flex items-center gap-px bg-crust px-2 pt-2 shrink-0">
        <Show when={tabs()}>
          <For each={tabs()}>
            {([tab, sounds]: [SoundTab, string[]]) => (
              <div
                class={`group flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer rounded-t select-none transition-colors ${
                  isCurrentTab(tab)
                    ? "bg-surface-0 text-text"
                    : "bg-mantle text-subtext-0 hover:bg-surface-1 hover:text-subtext-1"
                }`}
                onClick={() => setCurrentTab([tab, sounds])}
              >
                <span>{tab.name}</span>
                <div
                  class="opacity-0 group-hover:opacity-100 hover:text-red transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveTab(tab.id);
                  }}
                >
                  <Trash2 class="w-3 h-3" />
                </div>
              </div>
            )}
          </For>
        </Show>
        <div
          class="flex items-center gap-1.5 px-3 py-1.5 text-sm text-subtext-0 hover:text-text cursor-pointer rounded-t select-none transition-colors"
          onClick={handleAddTab}
        >
          <Plus class="w-3.5 h-3.5" />
          <span>Add tab</span>
        </div>
      </div>

      {/* Sounds list */}
      <div class="flex-1 overflow-y-auto bg-base">
        <Show
          when={currentTab()}
          fallback={
            <p class="text-sm text-subtext-0 p-4">
              {tabs()?.length === 0
                ? "No tabs are created yet. Use a button above to add one."
                : "Loading..."}
            </p>
          }
        >
          <For
            each={currentTab()?.[1]}
            fallback={
              <p class="text-sm text-subtext-0 p-4">
                No sound files are found in this folder.
              </p>
            }
          >
            {(sound, i) => (
              <SoundItem
                sound={sound}
                odd={i() % 2 !== 0}
                registered={findHotkeyForSound(sound)}
                onPlay={() => props.handlePlaySound(sound)}
                onStartCapture={() => handleStartCapture(sound)}
                onUnregister={(e) => handleUnregister(e, sound)}
              />
            )}
          </For>
        </Show>
      </div>
    </div>
  );
}
