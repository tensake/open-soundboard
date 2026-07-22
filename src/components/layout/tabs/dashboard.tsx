import { createEffect, createSignal, For, Show, onCleanup } from "solid-js";
import { Plus, Folder, FolderOpen, X, Repeat, Shuffle } from "lucide-solid";
import { open } from "@tauri-apps/plugin-dialog";
import {
  tabs,
  refetchTabs,
  addTab,
  removeTab,
  refetchHotkeys,
  registerHotkey,
  unregisterHotkey,
  findHotkeyForSound,
  playSoundTabMode,
  playlistMode,
  nextPlaylistMode,
  setCurrentTabPaths,
  currentTab,
  setCurrentTab,
} from "../../../lib";
import type { HotKeyEntry, SoundFile } from "../../../lib";
import { alerts } from "../../../lib/alert";
import { SoundTab } from "../../../lib/types";
import HotkeyOverlay from "../hotkeyOverlay";
import AlertItem from "../../ui/alert";
import SoundItem from "../../ui/sounds/soundItem";
import UpdateNotification from "../../ui/updateNotification";

export default function Dashboard() {
  const [searchQuery, setSearchQuery] = createSignal<string | null>(null);
  const [capturingFor, setCapturingFor] = createSignal<string | null>(null);

  createEffect(async () => {
    const loadedTabs = tabs();
    if (!currentTab() && loadedTabs?.length) {
      setCurrentTab(loadedTabs[0]);
    }
  });

  // Refresh tabs every 5 seconds
  createEffect(() => {
    const interval = setInterval(async () => {
      await refetchTabs();
      const activeTab = currentTab()?.[0];
      if (activeTab) {
        const updatedTab = tabs()?.find(([t]) => t.id === activeTab.id);
        if (updatedTab) {
          setCurrentTab(updatedTab);
        }
      }
    }, 5000);

    onCleanup(() => clearInterval(interval));
  });

  // Update current sounds from tab for playlist
  createEffect(() => {
    setCurrentTabPaths(currentTab()?.[1].map((s) => s.path) ?? []);
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

  const filteredSounds = () => {
    const sounds = currentTab()?.[1] ?? [];
    const q = searchQuery()?.toLowerCase();
    return q
      ? sounds.filter((s) => s.path.split(/[\\/]/).pop()!.toLowerCase().includes(q))
      : sounds;
  };

  const isCurrentTab = (tab: SoundTab) => currentTab()?.[0].id === tab.id;

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
          <div
            class="flex items-center gap-px min-w-0 overflow-x-auto flex-1"
            style={{ "scrollbar-width": "none" }}
            onWheel={(e) => {
              // Make vertical scroll horizontal
              e.preventDefault();
              e.currentTarget.scrollLeft += e.deltaY;
            }}
          >
            <Show when={(tabs()?.length ?? 0) > 0}>
              <For each={tabs()}>
                {([tab, sounds]: [SoundTab, SoundFile[]]) => (
                  <div
                    class={`group flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer rounded-t select-none transition-colors shrink-0 w-36 ${
                      isCurrentTab(tab)
                        ? "bg-enabled text-primary-400"
                        : "bg-disabled text-subtext-0 hover:bg-enabled hover:text-subtext-1"
                    }`}
                    onClick={async () => {
                      await refetchTabs();
                      const recentTab = tabs()?.find(([t]) => t.id === tab.id);
                      setCurrentTab(recentTab ?? [tab, sounds]);
                      setSearchQuery(null);
                    }}
                  >
                    {isCurrentTab(tab)
                      ? <FolderOpen class="w-3.5 h-3.5 shrink-0" />
                      : <Folder class="w-3.5 h-3.5 shrink-0" />
                    }
                    <span class="truncate flex-1">{tab.name}</span>
                    <div
                      class="hover:text-red transition-opacity shrink-0 ml-auto"
                      onClick={async (e) => {
                        e.stopPropagation();
                        await removeTab(tab.id);
                        await refetchTabs();

                        // Clear search query and current tab if no tabs remain
                        if (isCurrentTab(tab)) {
                          setSearchQuery(null);
                          setCurrentTab(null);
                        };
                      }}
                    >
                      <X class="w-3 h-3" />
                    </div>
                  </div>
                )}
              </For>
            </Show>
            <div
              class="flex items-center gap-1.5 px-3 py-1.5 text-sm text-subtext-0 hover:text-text cursor-pointer rounded-t select-none transition-colors shrink-0"
              onClick={handleAddTab}
            >
              <Plus class="w-3.5 h-3.5" />
            </div>
          </div>
        </div>

        {/* Search */}
        <div class="bg-mantle px-2 py-1.5 shrink-0 flex items-center gap-2 border-t border-surface-0 border-l border-b rounded-t-md pr-2">
          <input
            type="text"
            class="w-full bg-base text-sm truncate"
            placeholder="Start typing here to search..."
            value={searchQuery() ?? ""}
            onInput={(e) => setSearchQuery(e.currentTarget.value || null)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const first = filteredSounds()[0].path;
                if (first) playSoundTabMode(first);
              }
            }}
          />

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
                  <button
                    class="rounded-md bg-primary px-4 py-2 text-white transition hover:bg-primary/90"
                    onClick={handleAddTab}
                  >
                    Add Tab
                  </button>
                </div>
              ) : (
                "Loading..."
              )}
            </div>
          }
        >
          <For
            each={filteredSounds()}
            fallback={
              <p class="text-sm text-subtext-0 p-4">
                No sound files are found in this folder.
              </p>
            }
          >
            {(sound, i) => (
              <SoundItem
                sound={sound}
                odd={i() % 2 !== 0}
                registered={findHotkeyForSound(sound.path)}
                onPlay={() => playSoundTabMode(sound.path)}
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
