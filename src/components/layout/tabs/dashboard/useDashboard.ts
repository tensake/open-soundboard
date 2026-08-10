import { createEffect, createSignal, createResource, onCleanup } from "solid-js";
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
  currentTab,
  setCurrentTab,
  getSoundsHistory,
  editTab,
  setSoundConfig,
  getSoundsConfig,
  SoundConfig,
} from "../../../../lib";
import type { HotKeyEntry } from "../../../../lib";
import { SortOrder } from "../../../../lib";

export function useDashboard() {
  const [searchQuery, setSearchQuery] = createSignal<string | null>(null);
  const [sortOrder, setSortOrder] = createSignal<SortOrder>("Default");
  const [capturingFor, setCapturingFor] = createSignal<string | null>(null);
  const [soundsHistory, { refetch: refetchSoundsHistory }] = createResource(getSoundsHistory);
  const [soundsConfig, { refetch: refetchSoundsConfig }] = createResource(getSoundsConfig);

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

  const getSoundCfg = (path: string): SoundConfig | null =>
    soundsConfig()?.[path] ?? null;

  const filteredSounds = () => {
    const all = currentTab()?.[1] ?? [];
    const q = searchQuery()?.toLowerCase();
    return q
      ? all.filter((s) => s.path.split(/[\\/]/).pop()!.toLowerCase().includes(q))
      : all;
  };

  const sortedSounds = () => {
    const tabId = currentTab()?.[0].id;
    const all = filteredSounds();
    const pinned = tabId ? all.filter(s => soundsConfig()?.[s.path]?.pins.includes(tabId)) : [];
    const unpinned = tabId ? all.filter(s => !soundsConfig()?.[s.path]?.pins.includes(tabId)) : all;
    const sortFn = (a: typeof all[0], b: typeof all[0]) => {
      switch (sortOrder()) {
        case "Size": return b.size - a.size;
        case "Date": return new Date(b.datetime).getTime() - new Date(a.datetime).getTime();
        case "Duration": return b.duration - a.duration;
        default: return 0;
      }
    };
    return [...pinned.sort(sortFn), ...unpinned.sort(sortFn)];
  };

  const soundInHistory = (path: string) => soundsHistory()?.includes(path) ?? false;

  const handleAddTab = async () => {
    const selected = await open({ directory: true, multiple: false });
    if (!selected) return;
    const name = selected.split(/[\\/]/).pop() ?? selected;
    await addTab(name, "directory", selected);
  };

  const handleAddUserTab = async () => {
    const name = `tab ${(tabs()?.length ?? 0) + 1}`;
    await addTab(name, "user");
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

  const handleToggleTag = async (path: string, tag: string) => {
    const existing = getSoundCfg(path) ?? { tags: [], pins: [] };
    const hasTag = existing.tags.includes(tag);
    const updated: SoundConfig = {
      ...existing,
      tags: hasTag ? existing.tags.filter(t => t !== tag) : [...existing.tags, tag],
    };
    await setSoundConfig(path, updated);
    refetchSoundsConfig();
  };

  const handleTogglePin = async (path: string) => {
    const tabId = currentTab()?.[0].id;
    if (!tabId) return;
    const existing = getSoundCfg(path) ?? { tags: [], pins: [] };
    const isPinned = existing.pins.includes(tabId);
    const updated: SoundConfig = {
      ...existing,
      pins: isPinned ? existing.pins.filter(id => id !== tabId) : [...existing.pins, tabId],
    };
    await setSoundConfig(path, updated);
    refetchSoundsConfig();
  };

  const handleRemoveFromTab = async (path: string) => {
    const tab = currentTab()?.[0];
    if (!tab || tab.kind !== "user") return;
    await editTab({ ...tab, sounds: tab.sounds.filter(s => s !== path) });
    const updated = await getTab(tab.id);
    if (updated) setCurrentTab(updated);
  };

  const handleAddSounds = async () => {
    const allowed = new Set(["mp3", "wav", "flac", "vorbis", "ogg", "isomp4", "aac", "pcm"]);
    const tab = currentTab()?.[0];
    if (!tab || tab.kind !== "user") return;
    const selected = await open({
      multiple: true,
      filters: [{ name: "Audio", extensions: [...allowed.values()] }],
    });
    if (!selected) return;
    const files = (Array.isArray(selected) ? selected : [selected])
      .filter(f => {
        const ext = f.split(".").pop()?.toLowerCase();
        return ext && allowed.has(ext);
      });
    const existing = new Set(tab.sounds ?? []);
    const deduped = files.filter(f => !existing.has(f));
    if (!deduped.length) return;
    await editTab({ ...tab, sounds: [...(tab.sounds ?? []), ...deduped] });
    const updated = await getTab(tab.id);
    if (updated) setCurrentTab(updated);
  };

  return {
    searchQuery, setSearchQuery,
    sortOrder, setSortOrder,
    capturingFor, setCapturingFor,
    soundsConfig,
    filteredSounds,
    sortedSounds,
    soundInHistory,
    getSoundCfg,
    handleAddTab,
    handleAddUserTab,
    handleCapture,
    handleUnregister,
    handlePlay,
    handleToggleTag,
    handleTogglePin,
    handleRemoveFromTab,
    handleAddSounds,
  };
}
