import {
  createSignal,
  createEffect,
  For,
  Switch,
  Match,
  onMount,
} from "solid-js";
import { LayoutDashboard, Settings as SettingsIcon } from "lucide-solid";
import { getActiveSounds } from "./lib";
import { Tab } from "./types";
import Dashboard from "./components/tabs/dashboard";
import Settings from "./components/tabs/settings";
import SoundsList from "./components/soundsList";
import "./App.css";

const TABS = {
  [Tab.Dashboard]: { icon: LayoutDashboard },
  [Tab.Settings]: { icon: SettingsIcon },
};

let registerSound: (id: number, path: string) => void = () => {};

export default function App() {
  const [activeTab, setActiveTab] = createSignal<Tab>(Tab.Dashboard);

  const [volumePct, setVolumePct] = createSignal(
    Number(localStorage.getItem("volumePct") ?? 100),
  );
  const [micVolumePct, setMicVolumePct] = createSignal(
    Number(localStorage.getItem("micVolumePct") ?? 100),
  );

  onMount(async () => {
    const ids = await getActiveSounds();
    ids.forEach((id) => registerSound(id, ""));
  });

  createEffect(() => {
    localStorage.setItem("volumePct", String(volumePct()));
    localStorage.setItem("micVolumePct", String(micVolumePct()));
  });

  const handleSoundPlayed = (id: number, path: string) => {
    registerSound(id, path);
  };

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
                onSoundPlayed={handleSoundPlayed}
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
