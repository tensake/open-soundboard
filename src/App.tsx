import { createSignal, For, Switch, Match, onMount } from "solid-js";
import { listen } from "@tauri-apps/api/event";
import {
  getActiveSounds,
  HotKeyEntry,
  registerHotkeyCmd,
  hotkeys,
  refetchHotkeys,
  playSound,
  controlActions,
  registerSound,
  listenAlerts,
  ControlAction,
  Tab,
  TABS,
  markAsReady,
  checkForUpdate,
} from "./lib";
import Dashboard from "./components/layout/tabs/dashboard";
import Settings from "./components/layout/tabs/settings";
import SoundsList from "./components/ui/sounds/soundsList";
import "./App.css";

export default function App() {
  const [activeTab, setActiveTab] = createSignal<Tab>(Tab.Dashboard);
  onMount(async () => {
    // Register all active sounds
    const ids = await getActiveSounds();
    ids.forEach((id) => registerSound(id, ""));

    // Register all hotkeys
    for (const hk of hotkeys.latest ?? []) {
      try {
        await registerHotkeyCmd(hk);
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

    // Mark frontend as ready
    await markAsReady();

    // Check for update
    await checkForUpdate();
  });

  return (
    <main class="flex h-screen w-screen overflow-hidden">
      <nav class="flex flex-col gap-2 p-4 w-18 bg-mantle">
        <For each={Object.values(Tab)}>
          {(tabValue) => {
            const meta = TABS[tabValue];
            return (
              <div
                onClick={() => setActiveTab(tabValue)}
                class={`flex items-center gap-3 p-2 transition-colors cursor-pointer ${
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
        <div class="flex-1 overflow-y-auto">
          <Switch>
            <Match when={activeTab() === Tab.Dashboard}>
              <Dashboard />
            </Match>
            <Match when={activeTab() === Tab.Settings}>
              <Settings />
            </Match>
          </Switch>
        </div>

        <SoundsList />
      </div>
    </main>
  );
}
