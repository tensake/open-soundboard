import {
  createEffect,
  createResource,
  createSignal,
  For,
  Show,
} from "solid-js";
import type { Accessor, Setter } from "solid-js";
import { Play, Plus, Trash2 } from "lucide-solid";
import { open } from "@tauri-apps/plugin-dialog";
import { getTabs, addTab, removeTab } from "../../lib";
import { SoundTab } from "../../types";

interface DashboardProps {
  handlePlaySound: (path: string) => void | Promise<void>;
  volumePct: Accessor<number>;
  setVolumePct: Setter<number>;
}

export default function Dashboard(props: DashboardProps) {
  const [tabs, { refetch }] = createResource(getTabs);
  const [currentTab, setCurrentTab] = createSignal<[SoundTab, string[]] | null>(
    null,
  );

  createEffect(() => {
    const loadedTabs = tabs();
    if (!currentTab() && loadedTabs?.length) {
      setCurrentTab(loadedTabs[0]);
    }
  });

  const handleAddTab = async () => {
    const selected = await open({ directory: true, multiple: false });
    if (!selected) return;
    const name = selected.split(/[\\/]/).pop() ?? selected;
    await addTab(name, selected);
    refetch();
  };

  const handleRemoveTab = async (id: string) => {
    await removeTab(id);
    refetch();
  };

  const isCurrentTab = (tab: SoundTab) => currentTab()?.[0].id === tab.id;

  return (
    <div class="flex flex-col h-full overflow-hidden">
      {/* Tabs */}
      <div class="flex items-center gap-px bg-crust px-2 pt-2 shrink-0">
        <Show when={tabs()}>
          <For each={tabs()}>
            {([tab, sounds]: [SoundTab, string[]]) => (
              <div
                class={`group flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer rounded-t select-none transition-colors ${
                  isCurrentTab(tab)
                    ? "bg-surface-0 text-text"
                    : "bg-mantle text-subtext-0 hover:bg-surface-1 hover:text-subtext-1"
                }`}
                onClick={() => setCurrentTab([tab, sounds])}
              >
                <span>{tab.name}</span>
                <div
                  class="opacity-0 group-hover:opacity-100 hover:text-red transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveTab(tab.id);
                  }}
                >
                  <Trash2 class="w-3 h-3" />
                </div>
              </div>
            )}
          </For>
        </Show>
        <div
          class="flex items-center gap-1.5 px-3 py-1.5 text-sm text-subtext-0 hover:text-text cursor-pointer rounded-t select-none transition-colors"
          onClick={handleAddTab}
        >
          <Plus class="w-3.5 h-3.5" />
          <span>Add tab</span>
        </div>
      </div>

      {/* Sounds list */}
      <div class="flex-1 overflow-y-auto bg-base">
        <Show
          when={currentTab()}
          fallback={
            <p class="text-sm text-subtext-0 p-4">
              {tabs()?.length === 0
                ? "No tabs are created yet. Use a button above to add one."
                : "Loading..."}
            </p>
          }
        >
          <For
            each={currentTab()?.[1]}
            fallback={
              <p class="text-sm text-subtext-0 p-4">
                No sound files are found in this folder.
              </p>
            }
          >
            {(sound, i) => (
              <div
                class={`group flex items-center gap-2 px-3 py-1 cursor-pointer transition-colors ${
                  i() % 2 === 0 ? "bg-base" : "bg-mantle"
                } hover:bg-surface-0 hover:text-primary-400`}
                onClick={() => props.handlePlaySound(sound)}
              >
                <Play class="w-3 h-3 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                <span class="text-sm truncate">
                  {sound.split(/[\\/]/).pop()}
                </span>
              </div>
            )}
          </For>
        </Show>
      </div>
    </div>
  );
}
