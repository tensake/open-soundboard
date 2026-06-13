import { createSignal, onCleanup, For, Switch, Match } from "solid-js";
import { LayoutDashboard, Settings as SettingsIcon } from "lucide-solid";
import { getProgress, seekSound, formatTime } from "./lib";
import { Tab } from "./types";
import Dashboard from "./tabs/dashboard";
import Settings from "./tabs/settings";
import "./App.css";

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

  const [volumePct, setVolumePct] = createSignal(100);
  const [micVolumePct, setMicVolumePct] = createSignal(100);

  const handleSeekInput = (e: Event) => {
    setCurrent(parseFloat((e.currentTarget as HTMLInputElement).value));
  };

  const handleSeekCommit = (e: Event) => {
    const value = parseFloat((e.currentTarget as HTMLInputElement).value);
    const id = activeId();
    setCurrent(value);
    if (id != null) seekSound(id, value);
    setSeeking(false);
  };

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
                  activeTab() === tabValue ? "text-primary-600" : ""
                }`}
              >
                <meta.icon class="w-5 h-5 shrink-0" />
              </div>
            );
          }}
        </For>
      </nav>

      <div class="flex flex-col flex-1 justify-between p-4 min-w-0">
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

        <div class="flex flex-col gap-1 items-center border-t border-surface-1 pt-4 mt-4">
          <span class="text-sm font-mono">
            {formatTime(current())} / {formatTime(total())}
          </span>
          <input
            type="range"
            min="0"
            max={total() > 0 ? total() : 1}
            step="0.1"
            value={current()}
            onPointerDown={() => setSeeking(true)}
            onInput={handleSeekInput}
            onChange={handleSeekCommit}
            class="w-full max-w-xl cursor-pointer"
            disabled={activeId() == null}
          />
        </div>
      </div>
    </main>
  );
}
