import {
  createSignal,
  createEffect,
  onCleanup,
  For,
  Switch,
  Match,
  onMount,
} from "solid-js";
import { LayoutDashboard, Settings as SettingsIcon } from "lucide-solid";
import { getProgress, getActiveSounds } from "./lib";
import { Tab } from "./types";
import Dashboard from "./components/tabs/dashboard";
import Settings from "./components/tabs/settings";
import "./App.css";
import PlayerBar from "./components/playerBar";

const TABS = {
  [Tab.Dashboard]: { icon: LayoutDashboard },
  [Tab.Settings]: { icon: SettingsIcon },
};

export default function App() {
  const [activeTab, setActiveTab] = createSignal<Tab>(Tab.Dashboard);

  const [activeId, setActiveId] = createSignal<number | null>(null);
  const [current, setCurrent] = createSignal(0);
  const [total, setTotal] = createSignal(0);
  const [seeking, setSeeking] = createSignal(false);
  const [paused, setPaused] = createSignal(false);

  const [volumePct, setVolumePct] = createSignal(
    Number(localStorage.getItem("volumePct") ?? 100),
  );
  const [micVolumePct, setMicVolumePct] = createSignal(
    Number(localStorage.getItem("micVolumePct") ?? 100),
  );

  const interval = setInterval(async () => {
    const id = activeId();
    if (id == null || seeking()) return;

    const progress = await getProgress(id);
    if (progress) {
      setCurrent(progress.current);
      setTotal(progress.total);
    } else {
      setActiveId(null);
      setCurrent(0);
      setTotal(0);
      setPaused(false);
    }
  }, 100);

  onMount(async () => {
    const ids = await getActiveSounds();
    if (ids.length > 0) {
      setActiveId(ids[ids.length - 1]);
      setPaused(false);
    }
  });

  createEffect(() => {
    localStorage.setItem("volumePct", String(volumePct()));
    localStorage.setItem("micVolumePct", String(micVolumePct()));
  });

  onCleanup(() => clearInterval(interval));

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

      <div class="flex flex-col flex-1 justify-between min-w-0">
        <div class="flex-1 overflow-y-auto">
          <Switch>
            <Match when={activeTab() === Tab.Dashboard}>
              <Dashboard
                activeId={activeId}
                setActiveId={setActiveId}
                volumePct={volumePct}
                setVolumePct={setVolumePct}
                paused={paused}
                setPaused={setPaused}
                current={current}
                total={total}
              />
            </Match>
            <Match when={activeTab() === Tab.Settings}>
              <Settings
                micVolumePct={micVolumePct}
                setMicVolumePct={setMicVolumePct}
              />
            </Match>
          </Switch>
        </div>

        <PlayerBar
          activeId={activeId}
          setActiveId={setActiveId}
          paused={paused}
          setPaused={setPaused}
          current={current}
          setCurrent={setCurrent}
          total={total}
          setTotal={setTotal}
          seeking={seeking}
          setSeeking={setSeeking}
          volumePct={volumePct}
          setVolumePct={setVolumePct}
        />
      </div>
    </main>
  );
}
