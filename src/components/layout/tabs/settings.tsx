import {
  getMicVolume,
  hotkeys,
  refetchHotkeys,
  updateHotkey,
  registerHotkey,
  volumePct,
  micVolumePct,
  setMicVolumePct,
  CONTROL_ACTIONS,
  handleMicVolumeSlider,
  handleVolumeSlider,
} from "../../../lib";
import type { HotKeyEntry } from "../../../lib";
import { For, onMount, createSignal } from "solid-js";
import HotkeyOverlay from "../hotkeyOverlay";
import HotKeyItem from "../../ui/hotkeys/hotkeyItem";

export default function Settings() {
  const [capturingHotkey, setCapturingHotkey] =
    createSignal<HotKeyEntry | null>(null);

  onMount(async () => {
    const vol = await getMicVolume();
    setMicVolumePct(Math.round(vol * 100));
  });

  const handleCapture = async (binding: string) => {
    const current = capturingHotkey();
    if (!current) return;

    if (current.id) {
      await updateHotkey({
        id: current.id,
        binding,
        kind: current.kind,
        context: current.context,
      });
      refetchHotkeys();
    } else {
      await registerHotkey({
        id: crypto.randomUUID(),
        binding,
        kind: current.kind,
        context: current.context,
      });
    }

    setCapturingHotkey(null);
  };

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
          value={micVolumePct()}
          onInput={handleMicVolumeSlider}
          class="w-full cursor-pointer"
        />
        <span class="text-sm">{micVolumePct()}%</span>
      </div>
      <div class="max-w-md">
        <h2 class="text-lg font-medium mb-1">General Volume</h2>
        <input
          type="range"
          min="0"
          max="100"
          step="1"
          value={volumePct()}
          onInput={handleVolumeSlider}
          class="w-full cursor-pointer"
        />
        <span class="text-sm">{volumePct()}%</span>
      </div>

      {/* Control Hotkeys */}
      <div class="max-w-xl">
        <h2 class="text-lg font-medium mb-3 text-text">Control Hotkeys</h2>
        <div class="grid grid-cols-1 gap-2">
          <For each={CONTROL_ACTIONS}>
            {(action) => {
              const registered = () =>
                hotkeys()?.find(
                  (hk) => hk.kind === "Control" && hk.context === action,
                );

              return (
                <HotKeyItem
                  hotkey={
                    registered() ?? {
                      id: "",
                      binding: "Click to bind",
                      kind: "Control",
                      context: action,
                    }
                  }
                  disabled={!registered()}
                  onStartCapture={(hk) => setCapturingHotkey(hk)}
                />
              );
            }}
          </For>
        </div>
      </div>

      {/* Sound Hotkeys */}
      <div class="max-w-xl">
        <h2 class="text-lg font-medium mb-3 text-text">
          Registered Sound Hotkeys
        </h2>
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
              <HotKeyItem
                hotkey={hotkey}
                disabled={false}
                onStartCapture={(hk) => setCapturingHotkey(hk)}
              />
            )}
          </For>
        </div>
      </div>
    </div>
  );
}
