import { For, Show } from "solid-js";
import { Repeat, Shuffle, Funnel, Plus } from "lucide-solid";
import { useDashboard } from "./useDashboard";
import {
  tabs,
  playlistMode,
  nextPlaylistMode,
  currentTab,
  findHotkeyForSound,
  sounds,
  SORT_ORDER,
  SortOrder,
} from "../../../../lib";
import { alerts } from "../../../../lib/alert";
import HotkeyOverlay from "../../hotkeyOverlay";
import AlertItem from "../../../ui/alert";
import SoundItem from "../../../ui/sounds/soundItem";
import UpdateNotification from "../../../ui/updateNotification";
import TabGroup from "../../../ui/tab/tabGroup";
import { Button } from "../../../ui/button";
import { Input } from "../../../ui/input";
import { Select } from "../../../ui/select";
import { Divider } from "../../../ui/divider";

export default function Dashboard() {
  const {
    searchQuery, setSearchQuery,
    sortOrder, setSortOrder,
    capturingFor, setCapturingFor,
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
  } = useDashboard();

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
            onAddUserTab={handleAddUserTab}
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
                const first = filteredSounds()[0]?.path;
                if (first) handlePlay(first);
              }
            }}
          />

          {/* Add sound button */}
          <Show when={currentTab()?.[0].kind === "user"}>
            <button
              class="flex items-center gap-1 px-2 py-1 text-xs text-subtext-0 hover:text-primary-400 shrink-0"
              onClick={handleAddSounds}
              title="Add sounds to this tab"
            >
              <Plus class="w-4 h-4" />
              Add sound
            </button>
          </Show>

          {/* Sort order */}
          <div class="relative flex items-center w-32 mx-2" title="Click to change sort order">
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

          <Divider class="w-1 h-full" />

          {/* Playlist mode */}
          <div
            class={`shrink-0 flex items-center justify-center cursor-pointer transition-colors px-2 ${
              playlistMode() === "disabled" ? "text-subtext-0" : "text-primary-400"
            }`}
            onClick={nextPlaylistMode}
            title={`Playlist mode: ${playlistMode()}`}
          >
            <Show when={playlistMode() === "shuffle"} fallback={<Repeat class="w-4 h-4" />}>
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
                  <Button onClick={handleAddTab}>Add Tab</Button>
                </div>
              ) : (
                "Loading..."
              )}
            </div>
          }
        >
          <For
            each={sortedSounds()}
            fallback={<p class="text-sm text-subtext-0 p-4">No sound files are found in this tab.</p>}
          >
            {(sound, i) => (
              <SoundItem
                currentTab={currentTab()?.[0] ?? null}
                isPlaying={sounds.some(s => s.path === sound.path && !s.paused)}
                isRecent={soundInHistory(sound.path)}
                sound={sound}
                odd={i() % 2 !== 0}
                registered={findHotkeyForSound(sound.path)}
                soundConfig={getSoundCfg(sound.path)}
                onPlay={() => handlePlay(sound.path)}
                onStartCapture={() => setCapturingFor(sound.path)}
                onUnregister={(e) => handleUnregister(e, sound.path)}
                onToggleFavourite={() => handleToggleTag(sound.path, "favourite")}
                onTogglePin={() => handleTogglePin(sound.path)}
                onRemove={() => handleRemoveFromTab(sound.path)}
              />
            )}
          </For>
        </Show>
      </div>
    </div>
  );
}
