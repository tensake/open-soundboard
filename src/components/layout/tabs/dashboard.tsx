import { createEffect, createSignal, For, Show, onCleanup, createResource } from "solid-js";
import { Repeat, Shuffle, Funnel } from "lucide-solid";
import { open } from "@tauri-apps/plugin-dialog";
import {
  tabs,
  getTab,
  addTab,
  refetchHotkeys,
  registerHotkey,
  unregisterHotkey,
  findHotkeyForSound,
  playSoundTabMode,
  playlistMode,
  nextPlaylistMode,
  currentTab,
  setCurrentTab,
  sounds,
  SORT_ORDER,
  getSoundsHistory,
} from "../../../lib";
import type { HotKeyEntry } from "../../../lib";
import { alerts } from "../../../lib/alert";
import HotkeyOverlay from "../hotkeyOverlay";
import AlertItem from "../../ui/alert";
import SoundItem from "../../ui/sounds/soundItem";
import UpdateNotification from "../../ui/updateNotification";
import TabGroup from "../../ui/tab/tabGroup";
import { SortOrder } from "../../../lib";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Select } from "../../ui/select";
import { Divider } from "../../ui/divider";

export default function Dashboard() {
  const [searchQuery, setSearchQuery] = createSignal<string | null>(null);
  const [sortOrder, setSortOrder] = createSignal<SortOrder>("Default");
  const [capturingFor, setCapturingFor] = createSignal<string | null>(null);
  const [soundsHistory, { refetch: refetchSoundsHistory }] =
    createResource(getSoundsHistory);

  createEffect(async () => {
    const loadedTabs = tabs();
    if (!currentTab() && loadedTabs?.length) {
      setCurrentTab(loadedTabs[0]);
    }
  });

  // Refresh current tab every 5 seconds
  createEffect(() => {
    const interval = setInterval(async () => {
      const active = currentTab();
      if (active) {
        const newTab = await getTab(active[0].id);
        if (newTab && (newTab[1].length !== active[1].length
          || newTab[1].some((sound, i) => sound.path !== active[1][i]?.path))
        ) {
          setCurrentTab(newTab);
        }
      }
    }, 5000);

    onCleanup(() => clearInterval(interval));
  });

  const handleAddTab = async () => {
    const selected = await open({ directory: true, multiple: false });
    if (!selected) return;
    const name = selected.split(/[\\/]/).pop() ?? selected;
    await addTab(name, selected);
  };

  const handleCapture = async (binding: string) => {
    const path = capturingFor();
    if (!path) return;

    const hk: HotKeyEntry = {
      id: crypto.randomUUID(),
      binding,
      kind: "Sound",
      context: path,
    };

    await registerHotkey(hk);
    refetchHotkeys();
    setCapturingFor(null);
  };

  const handleUnregister = async (e: MouseEvent, path: string) => {
    e.stopPropagation();
    const hk = findHotkeyForSound(path);
    if (!hk) return;
    await unregisterHotkey(hk.id);
    refetchHotkeys();
  };

  const handlePlay = async (path: string) => {
    await playSoundTabMode(path);
    await refetchSoundsHistory();
  };

  const filteredSounds = () => {
    const sounds = currentTab()?.[1] ?? [];
    const q = searchQuery()?.toLowerCase();
    return q
      ? sounds.filter((s) => s.path.split(/[\\/]/).pop()!.toLowerCase().includes(q))
      : sounds;
  };

  const sortedSounds = () => {
    const sounds = filteredSounds();
    switch (sortOrder()) {
      case "Size":
        return [...sounds].sort((a, b) => b.size - a.size);
      case "Date":
        return [...sounds].sort((a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime());
      case "Duration":
        return [...sounds].sort((a, b) => b.duration - a.duration);
      default:
        return sounds;
    }
  };

  const soundInHistory = (path: string) => {
    return soundsHistory()?.includes(path) ?? false;
  };

  return (
    <div class="flex flex-col h-full overflow-hidden bg-crust">
      <HotkeyOverlay
        capturingFor={capturingFor()}
        onCapture={handleCapture}
        onCancel={() => setCapturingFor(null)}
      />

      {/* Updater */}
      <UpdateNotification />

      {/* Alerts */}
      <For each={alerts()}>{(alert) => <AlertItem alert={alert} />}</For>

      <Show when={(tabs()?.length ?? 0) > 0}>
        {/* Tabs */}
        <div class="flex items-center bg-crust px-2 pt-2 shrink-0 min-w-0">
          <TabGroup
            onAddTab={handleAddTab}
            onTabChange={() => setSearchQuery(null)}
          />
        </div>

        {/* Search */}
        <div class="bg-mantle px-2 py-1.5 shrink-0 flex items-center gap-2 border-t border-surface-0 border-l border-b rounded-t-md pr-2">
          <Input
            class="bg-base!"
            placeholder="Start typing here to search..."
            value={searchQuery() ?? ""}
            onInput={(e) => setSearchQuery(e.currentTarget.value || null)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && searchQuery() !== null) {
                console.log(searchQuery())
                const first = filteredSounds()[0].path;
                if (first) playSoundTabMode(first);
              }
            }}
          />

          {/* Sort order */}
          <div class="relative flex items-center w-28 mx-2" title="Click to change sort order">
            <Funnel class="absolute left-2 size-3.5 text-subtext-0 pointer-events-none z-10" />
            <Select
              value={sortOrder()}
              class="appearance-none pl-7! text-subtext-0 bg-base"
              onChange={(e) => setSortOrder(e.currentTarget.value as SortOrder)}
            >
              <For each={SORT_ORDER}>
                {(order) => <option value={order}>{order}</option>}
              </For>
            </Select>
          </div>
          <Divider class="w-0.5 h-full" />

          {/* Playlist mode */}
          <div
            class={`shrink-0 flex items-center justify-center cursor-pointer transition-colors px-2 ${
              playlistMode() === "disabled"
                ? "text-subtext-0"
                : "text-primary-400"
            }`}
            onClick={nextPlaylistMode}
            title={`Playlist mode: ${playlistMode()}`}
          >
            <Show
              when={playlistMode() === "shuffle"}
              fallback={<Repeat class="w-4 h-4" />}
            >
              <Shuffle class="w-4 h-4" />
            </Show>
          </div>
        </div>
      </Show>

      {/* Sounds list */}
      <div class="flex-1 overflow-y-auto bg-base">
        <Show
          when={currentTab()}
          fallback={
            <div class="flex min-h-50 flex-col items-center justify-center p-8 text-center text-sm text-subtext-0">
              {tabs()?.length === 0 ? (
                <div class="flex flex-col items-center gap-3">
                  <h1>No tabs are created yet. Click to add one!</h1>
                  <Button
                    onClick={handleAddTab}
                  >
                    Add Tab
                  </Button>
                </div>
              ) : (
                "Loading..."
              )}
            </div>
          }
        >
          <For
            each={sortedSounds()}
            fallback={
              <p class="text-sm text-subtext-0 p-4">
                No sound files are found in this folder.
              </p>
            }
          >
            {(sound, i) => (
              <SoundItem
                isPlaying={sounds.some(s => s.path === sound.path && !s.paused)}
                isRecent={soundInHistory(sound.path)}
                sound={sound}
                odd={i() % 2 !== 0}
                registered={findHotkeyForSound(sound.path)}
                onPlay={() => handlePlay(sound.path)}
                onStartCapture={() => setCapturingFor(sound.path)}
                onUnregister={(e) => handleUnregister(e, sound.path)}
              />
            )}
          </For>
        </Show>
      </div>
    </div>
  );
}
