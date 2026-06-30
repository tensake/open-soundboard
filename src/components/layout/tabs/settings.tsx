import {
  hotkeys,
  refetchHotkeys,
  updateHotkey,
  registerHotkey,
  volumePct,
  micVolumePct,
  CONTROL_ACTIONS,
  handleMicVolumeSlider,
  handleVolumeSlider,
  SETTINGS_TABS,
  customCss,
  applyCustomCss,
  saveCustomCss,
  setAutoStart,
  autoStartSignal,
  handleAllSoundPlaybackSpeedSlider,
  soundPlaybackSpeed,
  setMicPitch,
  micPitchPct,
  setMicPitchPct,
  normalizationSignal,
  setNormalization,
} from "../../../lib";
import type { HotKeyEntry } from "../../../lib";
import { For, createSignal, Switch, Match } from "solid-js";
import HotkeyOverlay from "../hotkeyOverlay";
import HotKeyItem from "../../ui/hotkeys/hotkeyItem";
import { Transition } from "solid-transition-group";

export default function Settings() {
  const [activeTab, setActiveTab] = createSignal("sound");
  const [draftCss, setDraftCss] = createSignal("");
  const [capturingHotkey, setCapturingHotkey] =
    createSignal<HotKeyEntry | null>(null);

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
    <div class="flex h-full overflow-y-auto">
      <HotkeyOverlay
        capturingFor={capturingHotkey() ? capturingHotkey()!.context : null}
        onCapture={handleCapture}
        onCancel={() => setCapturingHotkey(null)}
      />

      {/* Sidebar */}
      <nav class="w-48 shrink-0 p-3 flex flex-col gap-0.5 border-r border-surface-0">
        <For each={SETTINGS_TABS}>
          {(tab) => (
            <div
              role="button"
              tabIndex={0}
              onClick={() => setActiveTab(tab.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setActiveTab(tab.id);
                }
              }}
              class={`select-none cursor-pointer px-3 py-1.5 rounded-md text-sm font-medium transition-colors duration-200 hover:bg-primary-400/10 ${
                activeTab() === tab.id ? "text-primary-400" : "text-subtext-1"
              }`}
            >
              {tab.label}
            </div>
          )}
        </For>
      </nav>

      {/* Content */}
      <div class="flex-1 overflow-y-auto p-6">
        <Transition name="fade" mode="outin">
          <Switch>
            {/* Sound tab */}
            <Match when={activeTab() === "sound"}>
              <div class="flex flex-col gap-8">
                <h1 class="text-2xl font-bold mb-4">Sound</h1>

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

                <div class="max-w-md">
                  <h2 class="text-lg font-medium mb-1">Sound Speed</h2>
                  <input
                    type="range"
                    min="0.5"
                    max="2.5"
                    step="0.05"
                    value={soundPlaybackSpeed()}
                    onInput={handleAllSoundPlaybackSpeedSlider}
                    class="w-full cursor-pointer"
                  />
                  <span class="text-sm">{soundPlaybackSpeed()}x</span>
                </div>

                <div class="max-w-xl flex flex-col gap-2">
                  <div class="flex items-center justify-between">
                    <h2 class="text-sm shrink-0">Normalize sound volume</h2>
                    <input
                      type="checkbox"
                      checked={normalizationSignal()}
                      onInput={(e) => setNormalization(e.currentTarget.checked)}
                    />
                  </div>
                </div>
              </div>
            </Match>

            {/* Microphone */}
            <Match when={activeTab() === "microphone"}>
              <div class="flex flex-col gap-8">
                <h1 class="text-2xl font-bold mb-4">Microphone</h1>

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
                  <h2 class="text-lg font-medium mb-1">Mic Pitch</h2>
                  <input
                    type="range"
                    min="-12"
                    max="12"
                    step="1"
                    value={micPitchPct()}
                    onInput={(e) => {
                      const v = Number(e.currentTarget.value);
                      setMicPitchPct(v);
                      setMicPitch(v);
                    }}
                    class="w-full cursor-pointer"
                  />
                  <span class="text-sm">{micPitchPct()} st</span>
                </div>
              </div>
            </Match>

            {/* Appearance tab */}
            <Match when={activeTab() === "appearance"}>
              <div>
                <h1 class="text-2xl font-bold mb-4">Appearance</h1>

                <div class="max-w-xl flex flex-col gap-2">
                  <div class="flex items-center justify-between">
                    <h2 class="text-lg font-medium mb-1">Custom CSS</h2>
                    <button onClick={() => saveCustomCss(draftCss())}>
                      Save CSS
                    </button>
                  </div>
                  <textarea
                    rows={16}
                    class="w-full"
                    placeholder="Enter your own css here."
                    value={customCss()}
                    onInput={(e) => {
                      const val = e.currentTarget.value;
                      setDraftCss(val);
                      applyCustomCss(val);
                    }}
                  />
                </div>
              </div>
            </Match>

            {/* Hotkeys tab */}
            <Match when={activeTab() === "hotkeys"}>
              <div>
                <h1 class="text-2xl font-bold mb-4">Hotkeys</h1>

                <div class="max-w-xl mb-6">
                  <h2 class="text-lg font-medium mb-3 text-text">
                    Control Hotkeys
                  </h2>
                  <div class="grid grid-cols-1 gap-2">
                    <For each={CONTROL_ACTIONS}>
                      {(action) => {
                        const registered = () =>
                          hotkeys()?.find(
                            (hk) =>
                              hk.kind === "Control" && hk.context === action,
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

                <div class="max-w-xl">
                  <h2 class="text-lg font-medium mb-3 text-text">
                    Registered Sound Hotkeys
                  </h2>
                  <div class="grid grid-cols-1 gap-2">
                    <For
                      each={hotkeys()?.filter((hk) => hk.kind === "Sound")}
                      fallback={
                        <div class="text-sm text-subtext-1">
                          No hotkeys are registered yet. Use the dashboard to
                          add one!
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
            </Match>

            {/* System tab */}
            <Match when={activeTab() === "system"}>
              <div>
                <h1 class="text-2xl font-bold mb-4">System Settings</h1>

                <div class="max-w-xl flex flex-col gap-2">
                  <div class="flex items-center justify-between">
                    <h2 class="text-sm shrink-0">
                      Start the soundboard with system in the background.
                    </h2>
                    <input
                      type="checkbox"
                      checked={autoStartSignal()}
                      onInput={(e) => setAutoStart(e.currentTarget.checked)}
                    />
                  </div>
                </div>
              </div>
            </Match>
          </Switch>
        </Transition>
      </div>
    </div>
  );
}
