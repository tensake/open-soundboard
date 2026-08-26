import {
  createSignal,
  For,
  Switch,
  Match,
  onMount,
  createEffect,
  Show,
  onCleanup,
} from "solid-js";
import { listen } from "@tauri-apps/api/event";
import {
  hotkeys,
  refetchHotkeys,
  playSound,
  controlActions,
  registerSound,
  listenAlerts,
  ControlAction,
  UITabKind,
  TABS,
  startProgressPolling,
  stopProgressPolling,
  checkForUpdate,
  customCss,
  applyCustomCss,
  onboard,
  initConfig,
  onboarded,
  unwrapOrThrow,
} from "./lib";
import Dashboard from "./components/layout/tabs/dashboard/dashboard";
import Audio from "./components/layout/tabs/audio";
import Settings from "./components/layout/tabs/settings";
import SoundsList from "./components/ui/sounds/soundsList";
import OnboardingScreen from "./components/layout/onboardingScreen";
import { Transition } from "solid-transition-group";
import "./App.css";
import { commands, HotKeyEntry } from "./bindings";

export default function App() {
  const [activeTab, setActiveTab] = createSignal<UITabKind>(UITabKind.Dashboard);
  onMount(async () => {
    // Register all active sounds
    const ids = await commands.getActiveSounds();
    ids.forEach((id) => registerSound(id, ""));

    // Register all hotkeys
    for (const hk of hotkeys.latest ?? []) {
      try {
        await commands.registerHotkey(hk);
      } catch (e) {
        console.warn("hotkey already registered", hk, e);
      }
    }
    await refetchHotkeys();

    // Listen for alerts
    await listenAlerts();

    // Listen for hotkeys
    await listen("hotkey-pressed", async (event) => {
      const hotkey = event.payload as HotKeyEntry;
      if (hotkey.kind === "Sound") {
        playSound(hotkey.context);
      }

      if (hotkey.kind === "Control") {
        const action = controlActions[hotkey.context as ControlAction];
        if (action) {
          await action();
        }
      }
    });

    // Initialize from config
    await initConfig();

    startProgressPolling();

    // Check for update
    await checkForUpdate();

    // Mark frontend as ready
    await commands.markAsReady();
  });

  onCleanup(stopProgressPolling);

  createEffect(() => {
    // Apply custom css
    const css = customCss();
    if (css !== undefined) applyCustomCss(unwrapOrThrow(css));
  });

  return (
    <Show
      when={onboarded()}
      fallback={<OnboardingScreen onComplete={onboard} />}
    >
      <main class="flex h-screen w-screen overflow-hidden">
        <nav class="flex flex-col gap-2 p-4 w-18 bg-mantle">
          <For each={Object.values(UITabKind)}>
            {(tabValue) => {
              const meta = TABS[tabValue];
              return (
                <div
                  onClick={() => setActiveTab(tabValue)}
                  class={`flex items-center gap-3 p-2 transition-colors duration-200 cursor-pointer ${
                    activeTab() === tabValue ? "text-primary-400" : ""
                  }`}
                >
                  <meta.icon class="w-5 h-5 shrink-0" />
                </div>
              );
            }}
          </For>
        </nav>

        <div class="flex flex-col flex-1 min-w-0">
          <div class="flex-1 overflow-hidden">
            <Transition name="fade">
              <Switch>
                <Match when={activeTab() === UITabKind.Dashboard}>
                  <Dashboard />
                </Match>
                <Match when={activeTab() === UITabKind.Audio}>
                  <Audio />
                </Match>
                <Match when={activeTab() === UITabKind.Settings}>
                  <Settings />
                </Match>
              </Switch>
            </Transition>
          </div>

          <SoundsList />
        </div>
      </main>
    </Show>
  );
}
