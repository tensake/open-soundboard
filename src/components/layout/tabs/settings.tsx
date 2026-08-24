import {
  hotkeys,
  refetchHotkeys,
  registerHotkey,
  CONTROL_ACTIONS,
  SETTINGS_TABS,
  customCss,
  applyCustomCss,
  saveCustomCss,
  setAutoStart,
  setNormalization,
  autoStart,
  soundState,
  micState,
  setMicState,
  normalization,
  handleSpeedSlider,
  unwrap,
} from "../../../lib";
import { HotKeyEntry, commands } from "../../../bindings";
import { For, createSignal, Switch, Match } from "solid-js";
import HotkeyOverlay from "../hotkeyOverlay";
import HotKeyItem from "../../ui/hotkeys/hotkeyItem";
import SettingSlider from "../../ui/settings/settingSlider";
import SettingToggle from "../../ui/settings/settingToggle";
import SidebarTab from "../../ui/settings/sidebarTab";
import { Transition } from "solid-transition-group";
import { Button } from "../../ui/button";
import { Textarea } from "../../ui/textarea";

export default function Settings() {
  const [activeTab, setActiveTab] = createSignal("general");
  const [draftCss, setDraftCss] = createSignal("");
  const [capturingHotkey, setCapturingHotkey] =
    createSignal<HotKeyEntry | null>(null);

  const handleCapture = async (binding: string) => {
    const current = capturingHotkey();
    if (!current) return;

    if (current.id) {
      await commands.updateHotkey({
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
            <SidebarTab
              label={tab.label}
              active={activeTab() === tab.id}
              onClick={() => setActiveTab(tab.id)}
            />
          )}
        </For>
      </nav>

      {/* Content */}
      <div class="flex-1 overflow-y-auto p-6">
        <Transition name="fade" mode="outin">
          <Switch>
            {/* Audio tab */}
            <Match when={activeTab() === "general"}>
              <div class="flex flex-col gap-4">
                <h1 class="text-2xl font-bold mb-4">General Settings</h1>

                <div class="flex flex-col gap-4">
                  <h2 class="text-lg font-medium">Effects</h2>

                  <SettingSlider
                    label="Sound Speed"
                    min={0.5}
                    max={2.5}
                    step={0.05}
                    value={soundState.speed}
                    onInput={handleSpeedSlider}
                    valueLabel={`${soundState.speed}x`}
                  />

                  <SettingSlider
                    label="Microphone Pitch"
                    min={-12}
                    max={12}
                    step={1}
                    value={micState.pitch}
                    onInput={(e) => {
                      const v = Number(e.currentTarget.value);
                      setMicState({ pitch: v });
                      commands.setMicPitch(v);
                    }}
                    valueLabel={`${micState.pitch} st`}
                  />
                </div>

                <SettingToggle
                  title="Normalize sound volume"
                  description="Normalize sound volume, so that loud sounds are quieter and quiet sounds are louder."
                  checked={normalization() ?? false}
                  onInput={(e) => setNormalization(e.currentTarget.checked)}
                />
              </div>
            </Match>

            {/* Appearance tab */}
            <Match when={activeTab() === "appearance"}>
              <div>
                <h1 class="text-2xl font-bold mb-4">Appearance</h1>

                <div class="max-w-xl flex flex-col gap-2">
                  <div class="flex items-center justify-between">
                    <h2 class="text-lg font-medium mb-1">Custom CSS</h2>
                    <Button onClick={() => saveCustomCss(draftCss())}>
                      Save CSS
                    </Button>
                  </div>
                  <Textarea
                    rows={16}
                    placeholder="Enter your own css here."
                    value={unwrap(customCss())}
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
                          No hotkeys are registered yet. Use the sounds
                          dashboard page to add one!
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
              <div class="flex flex-col gap-6">
                <h1 class="text-2xl font-bold">System Settings</h1>

                <SettingToggle
                  title="Auto Start"
                  description="Start the soundboard with system in the background."
                  checked={unwrap(autoStart()) ?? false}
                  onInput={(e) => setAutoStart(e.currentTarget.checked)}
                />

                <Button class="self-start" onClick={commands.clearAllCache}>
                  Clear Cache
                </Button>
              </div>
            </Match>
          </Switch>
        </Transition>
      </div>
    </div>
  );
}
