import type { Accessor, Setter } from "solid-js";
import {
  getMicVolume,
  setMicVolume,
  setGeneralVolume,
  getHotkeys,
  unregisterHotkey,
  updateHotkey,
} from "../../lib";
import type { HotKeyEntry } from "../../lib";
import { Trash2 } from "lucide-solid";
import { For, onMount, createResource, createSignal } from "solid-js";
import HotkeyOverlay from "./../hotkeyOverlay";

interface SettingsProps {
  micVolumePct: Accessor<number>;
  setMicVolumePct: Setter<number>;
  volumePct: Accessor<number>;
  setVolumePct: Setter<number>;
}

export default function Settings(props: SettingsProps) {
  const [hotkeys, { refetch: refetchHotkeys }] = createResource(getHotkeys);
  const [capturingHotkey, setCapturingHotkey] =
    createSignal<HotKeyEntry | null>(null);

  onMount(async () => {
    const vol = await getMicVolume();
    props.setMicVolumePct(Math.round(vol * 100));
  });

  const handleMicVolume = (e: Event) => {
    const value = parseFloat((e.currentTarget as HTMLInputElement).value);
    props.setMicVolumePct(value);
    setMicVolume(value / 100);
  };

  const handleVolume = (e: Event) => {
    const value = parseFloat((e.currentTarget as HTMLInputElement).value);
    props.setVolumePct(value);
    setGeneralVolume(value / 100);
  };

  const handleCapture = async (binding: string) => {
    const current = capturingHotkey();
    if (!current) return;

    await updateHotkey({
      id: current.id,
      binding,
      kind: current.kind,
      context: current.context,
    });

    setCapturingHotkey(null);
    refetchHotkeys();
  };

  refetchHotkeys();

  return (
    <div class="flex flex-col gap-4 m-4">
      <HotkeyOverlay
        capturingFor={capturingHotkey() ? capturingHotkey()!.context : null}
        onCapture={handleCapture}
        onCancel={() => setCapturingHotkey(null)}
      />

      <h1 class="text-2xl font-bold">Settings</h1>
      <div class="max-w-md">
        <h2 class="text-lg font-medium mb-1">Microphone Volume</h2>
        <input
          type="range"
          min="0"
          max="300"
          step="1"
          value={props.micVolumePct()}
          onInput={handleMicVolume}
          class="w-full cursor-pointer"
        />
        <span class="text-sm">{props.micVolumePct()}%</span>
      </div>
      <div class="max-w-md">
        <h2 class="text-lg font-medium mb-1">General Volume</h2>
        <input
          type="range"
          min="0"
          max="100"
          step="1"
          value={props.volumePct()}
          onInput={handleVolume}
          class="w-full cursor-pointer"
        />
        <span class="text-sm">{props.volumePct()}%</span>
      </div>
      <div class="max-w-xl">
        <h2 class="text-lg font-medium mb-3 text-text">Registered Hotkeys</h2>
        <div class="grid grid-cols-1 gap-2">
          <For
            each={hotkeys()?.filter((hk) => hk.kind === "Sound")}
            fallback={
              <div class="text-sm text-subtext-1">
                No hotkeys are registered yet. Use the dashboard to add one!
              </div>
            }
          >
            {(hotkey) => (
              <div class="flex items-center justify-between gap-4 px-3 py-2 rounded-md transition-all bg-surface-0 hover:bg-surface-1">
                {/* Unregister button */}
                <div class="flex items-center gap-3 min-w-0 flex-1">
                  <button
                    onClick={async (_) => {
                      await unregisterHotkey(hotkey.id);
                      refetchHotkeys();
                    }}
                    title="Unregister hotkey"
                  >
                    <Trash2 class="w-3.5 h-3.5" />
                  </button>

                  {/* Context */}
                  <div class="flex flex-col min-w-0">
                    <span class="text-sm font-medium text-text truncate">
                      {hotkey.context.split(/[\\/]/).pop()}
                    </span>
                    <span class="text-xs text-subtext-1">{hotkey.kind}</span>
                  </div>
                </div>

                {/* Binding */}
                <div class="shrink-0">
                  <kbd
                    class="px-2 py-1 text-xs bg-mantle text-primary-400 rounded cursor-pointer select-none"
                    onClick={() => setCapturingHotkey(hotkey)}
                  >
                    {hotkey.binding}
                  </kbd>
                </div>
              </div>
            )}
          </For>
        </div>
      </div>
    </div>
  );
}
