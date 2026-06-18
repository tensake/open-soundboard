import {
  createSignal,
  createEffect,
  For,
  Switch,
  Match,
  onMount,
  onCleanup,
} from "solid-js";
import { listen } from "@tauri-apps/api/event";
import { Cherry, Settings as SettingsIcon } from "lucide-solid";
import {
  getActiveSounds,
  HotKeyEntry,
  registerHotkey,
  getHotkeys,
  playSound,
  stopAllSounds,
  resumeSound,
  pauseSound,
  setGeneralVolume,
  setMicVolume,
} from "./lib";
import { listenAlerts } from "./lib/alerts";
import { Tab } from "./types";
import Dashboard from "./components/layout/tabs/dashboard";
import Settings from "./components/layout/tabs/settings";
import SoundsList from "./components/sounds/soundsList";
import "./App.css";

const TABS = {
  [Tab.Dashboard]: { icon: Cherry },
  [Tab.Settings]: { icon: SettingsIcon },
};

let registerSound: (id: number, path: string) => void = () => {};
let unlisten: () => void;

export default function App() {
  const [activeTab, setActiveTab] = createSignal<Tab>(Tab.Dashboard);
  const [_, setAllHotkeys] = createSignal<HotKeyEntry[]>([]);
  const [muted, setMuted] = createSignal(0);
  const [micMuted, setMicMuted] = createSignal(0);
  const [paused, setPaused] = createSignal(false);

  const [volumePct, setVolumePct] = createSignal(
    Number(localStorage.getItem("volumePct") ?? 100),
  );
  const [micVolumePct, setMicVolumePct] = createSignal(
    Number(localStorage.getItem("micVolumePct") ?? 100),
  );

  const controlActions: Record<string, () => void | Promise<void>> = {
    Mute: () => {
      // Unmute
      if (muted() > 0 && volumePct() === 0) {
        setVolumePct(muted());
        setGeneralVolume(muted() / 100);
        setMuted(0);
      } else {
        // Mute
        setMuted(volumePct());
        setVolumePct(0);
        setGeneralVolume(0);
      }
    },
    MicMute: () => {
      // Unmute
      if (micMuted() > 0 && micVolumePct() === 0) {
        setMicVolumePct(micMuted());
        setMicVolume(micMuted() / 100);
        setMicMuted(0);
      } else {
        // Mute
        setMicMuted(micVolumePct());
        setMicVolumePct(0);
        setMicVolume(0);
      }
    },
    StopAll: () => {
      stopAllSounds();
    },
    PauseResumeAll: async () => {
      const ids = await getActiveSounds();
      if (paused()) {
        ids.forEach(resumeSound);
      } else {
        ids.forEach(pauseSound);
      }
      setPaused(!paused());
    },
  };

  onMount(async () => {
    // Register all active sounds
    const ids = await getActiveSounds();
    ids.forEach((id) => registerSound(id, ""));

    // Register all hotkeys
    const hotkeys = await getHotkeys();
    setAllHotkeys(hotkeys);
    hotkeys.forEach((hk) => registerHotkey(hk));

    // Listen for alerts
    const unlistenAlerts = listenAlerts();
    onCleanup(() => unlistenAlerts.then((f) => f()));

    // Listen for hotkeys
    unlisten = await listen("hotkey-pressed", async (event) => {
      const hotkey = event.payload as HotKeyEntry;
      if (hotkey.kind === "Sound") {
        handlePlaySound(hotkey.context);
      }

      if (hotkey.kind === "Control") {
        const action = controlActions[hotkey.context];
        if (action) {
          await action();
        } else {
          console.warn(`Unknown control action received: ${hotkey.context}`);
        }
      }
    });
  });

  createEffect(() => {
    localStorage.setItem("volumePct", String(volumePct()));
    localStorage.setItem("micVolumePct", String(micVolumePct()));
  });

  const handlePlaySound = async (path: string) => {
    const id = await playSound(path, volumePct() / 100);
    registerSound(id, path);
  };

  onCleanup(() => unlisten?.());

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
              <Dashboard
                handlePlaySound={handlePlaySound}
                volumePct={volumePct}
                setVolumePct={setVolumePct}
              />
            </Match>
            <Match when={activeTab() === Tab.Settings}>
              <Settings
                micVolumePct={micVolumePct}
                setMicVolumePct={setMicVolumePct}
                volumePct={volumePct}
                setVolumePct={setVolumePct}
              />
            </Match>
          </Switch>
        </div>

        <SoundsList onSoundAdded={(fn) => (registerSound = fn)} />
      </div>
    </main>
  );
}
