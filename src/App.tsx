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
import { Tab } from "./types";
import Dashboard from "./components/tabs/dashboard";
import Settings from "./components/tabs/settings";
import SoundsList from "./components/soundsList";
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

  const [volumePct, setVolumePct] = createSignal(
    Number(localStorage.getItem("volumePct") ?? 100),
  );
  const [micVolumePct, setMicVolumePct] = createSignal(
    Number(localStorage.getItem("micVolumePct") ?? 100),
  );

  const controlActions: Record<string, () => void | Promise<void>> = {
    Mute: () => {
      setVolumePct(0);
      setGeneralVolume(0);
    },
    Unmute: () => {
      setVolumePct(100);
      setGeneralVolume(1.0);
    },
    MicMute: () => {
      setMicVolumePct(0);
      setMicVolume(0);
    },
    MicUnmute: () => {
      setMicVolumePct(100);
      setMicVolume(1.0);
    },
    StopAll: () => {
      stopAllSounds();
    },
    PauseAll: async () => {
      const ids = await getActiveSounds();
      ids.forEach(pauseSound);
    },
    ResumeAll: async () => {
      const ids = await getActiveSounds();
      ids.forEach(resumeSound);
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

    // Listen for hotkeys
    unlisten = await listen("hotkey-pressed", async (event) => {
      const hotkey = event.payload as HotKeyEntry;
      if (hotkey.kind === "Sound") {
        handlePlaySound(hotkey.context);
      }

      if (hotkey.kind === "Control") {
        const action = controlActions[hotkey.binding];
        if (action) {
          await action();
        } else {
          console.warn(`Unknown control binding received: ${hotkey.binding}`);
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
