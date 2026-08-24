import { For, Show } from "solid-js";
import { Repeat, Shuffle, Funnel, Plus, Square, Pause, Mic, MicOff, Play } from "lucide-solid";
import {
  tabs,
  playlistMode,
  nextPlaylistMode,
  currentTab,
  SORT_ORDER,
  micState,
  paused,
  SortOrder,
  controlActions,
  handleVolumeSlider,
  soundState,
} from "../../../lib";
import TabGroup from "./tabGroup";
import { Input } from "../../ui/input";
import { Select } from "../../ui/select";
import { Divider } from "../../ui/divider";
import SettingSlider from "../settings/settingSlider";

interface TabBarProps {
  searchQuery: () => string | null;
  setSearchQuery: (v: string | null) => void;
  sortOrder: () => SortOrder;
  setSortOrder: (v: SortOrder) => void;
  filteredSounds: () => { path: string }[];
  onAddTab: () => void;
  onAddUserTab: () => void;
  onAddSounds: () => void;
  onPlay: (path: string) => void;
}

export default function TabBar(props: TabBarProps) {
  return (
    <Show when={(tabs()?.length ?? 0) > 0}>
      {/* Tabs */}
      <div class="flex items-center bg-crust px-2 pt-2 shrink-0 min-w-0 w-full">
        <TabGroup
          onAddTab={props.onAddTab}
          onAddUserTab={props.onAddUserTab}
          onTabChange={() => props.setSearchQuery(null)}
        />
      </div>

      {/* Tab Bar */}
      <div class="bg-mantle px-2 py-1.5 shrink-0 flex items-center gap-2 border-t border-surface-0 border-l border-b rounded-t-md pr-2">
        {/* Search query */}
        <Input
          class="bg-base!"
          placeholder="Start typing here to search..."
          value={props.searchQuery() ?? ""}
          onInput={(e) => props.setSearchQuery(e.currentTarget.value || null)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && props.searchQuery() !== null) {
              const first = props.filteredSounds()[0]?.path;
              if (first) props.onPlay(first);
            }
          }}
        />

        {/* Add sound button */}
        <Show when={currentTab()?.[0].kind === "user"}>
          <button
            class="flex items-center gap-1 px-2 py-1 text-xs text-subtext-0 hover:text-primary-400 shrink-0"
            onClick={props.onAddSounds}
            title="Add sounds to this tab"
          >
            <Plus class="w-4 h-4" />
            Add sound
          </button>

          <Divider class="w-0.5 h-full shrink-0" />
        </Show>

        {/* Global controls */}
        <div class="flex items-center gap-1">
          {/* Sound Volume */}
          <SettingSlider
            label=""
            min={0}
            max={100}
            step={1}
            value={soundState.volume}
            onInput={handleVolumeSlider}
            valueLabel={`Volume: ${soundState.volume}%`}
            class="w-48 px-4"
          />

          {/* Playlist mode */}
          <div
            class={`shrink-0 flex items-center justify-center cursor-pointer transition-colors px-2 ${
              playlistMode() === "disabled" ? "text-text" : "text-primary-400"
            }`}
            onClick={nextPlaylistMode}
            title={`Playlist mode: ${playlistMode()}`}
          >
            <Show when={playlistMode() === "shuffle"} fallback={<Repeat class="w-4 h-4" />}>
              <Shuffle class="w-4 h-4" />
            </Show>
          </div>

          {/* Pause/Resume */}
          <button
            title={paused() ? "Resume" : "Pause"}
            class="shrink-0 flex items-center justify-center cursor-pointer transition-colors px-2"
            onClick={controlActions.PauseResumeAll}
          >
            <Show when={paused()} fallback={<Pause class="w-4 h-4" />}>
              <Play class="w-4 h-4" />
            </Show>
          </button>

          {/* Stop all */}
          <button
            title="Stop all"
            class="shrink-0 flex items-center justify-center cursor-pointer transition-colors px-2"
            onClick={controlActions.StopAll}
          >
            <Square class="w-4 h-4" />
          </button>

          {/* Mic mute */}
          <button
            title={micState.muted ? "Unmute microphone" : "Mute microphone"}
            class="shrink-0 flex items-center justify-center cursor-pointer transition-colors px-2"
            onClick={controlActions.MicMute}
          >
            <Show when={micState.muted} fallback={<Mic class="w-4 h-4" />}>
              <MicOff class="w-4 h-4" />
            </Show>
          </button>
        </div>

        <Divider class="w-0.5 h-full shrink-0" />

        {/* Sort order */}
        <div class="relative flex items-center w-24 mx-2 shrink-0" title="Click to change sort order">
          <Funnel class="absolute left-2 size-3.5 text-subtext-0 pointer-events-none z-10" />
          <Select
            value={props.sortOrder()}
            class="appearance-none pl-7! text-subtext-0 bg-base"
            onChange={(e) => props.setSortOrder(e.currentTarget.value as SortOrder)}
          >
            <For each={SORT_ORDER}>
              {(order) => <option value={order}>{order}</option>}
            </For>
          </Select>
        </div>
      </div>
    </Show>
  );
}
