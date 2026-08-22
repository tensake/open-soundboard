import { For, Show } from "solid-js";
import { useDashboard } from "./useDashboard";
import {
  tabs,
  currentTab,
  findHotkeyForSound,
  sounds,
} from "../../../../lib";
import { alerts } from "../../../../lib/alert";
import HotkeyOverlay from "../../hotkeyOverlay";
import AlertItem from "../../../ui/alert";
import SoundItem from "../../../ui/sounds/soundItem";
import UpdateNotification from "../../../ui/updateNotification";
import { Button } from "../../../ui/button";
import TabBar from "../../../ui/tab/tabBar";

export default function Dashboard() {
  const {
    searchQuery,
    setSearchQuery,
    sortOrder,
    setSortOrder,
    capturingFor,
    setCapturingFor,
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
    <div class="flex flex-col h-full w-full overflow-hidden bg-crust">
      <HotkeyOverlay
        capturingFor={capturingFor()}
        onCapture={handleCapture}
        onCancel={() => setCapturingFor(null)}
      />

      {/* Updater */}
      <UpdateNotification />

      {/* Alerts */}
      <For each={alerts()}>{(alert) => <AlertItem alert={alert} />}</For>

      <TabBar
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        sortOrder={sortOrder}
        setSortOrder={setSortOrder}
        filteredSounds={filteredSounds}
        onAddTab={handleAddTab}
        onAddUserTab={handleAddUserTab}
        onAddSounds={handleAddSounds}
        onPlay={handlePlay}
      />

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
