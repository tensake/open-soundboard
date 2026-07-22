import { createSignal, For } from "solid-js";
import { Plus, Folder, FolderOpen, X } from "lucide-solid";
import {
  tabs,
  refetchTabs,
  removeTab,
  moveTab,
  currentTab,
  setCurrentTab,
} from "../../../lib";
import type { SoundFile } from "../../../lib";
import { SoundTab } from "../../../lib/types";

interface TabGroupProps {
  onAddTab?: () => void;
  onTabChange?: () => void;
}

export default function TabGroup(props: TabGroupProps) {
  const [draggedTabId, setDraggedTabId] = createSignal<string | null>(null);

  const isCurrentTab = (tab: SoundTab) => currentTab()?.[0].id === tab.id;

  const startDrag = (tabId: string) => {
    setDraggedTabId(tabId);
    const onMouseUp = () => {
      setDraggedTabId(null);
      document.removeEventListener("mouseup", onMouseUp);
    };
    document.addEventListener("mouseup", onMouseUp);
  };

  return (
    <div
      class="flex items-center gap-px min-w-0 overflow-x-auto flex-1"
      style={{ "scrollbar-width": "none" }}
      onWheel={(e) => {
        // Make vertical scroll horizontal
        e.preventDefault();
        e.currentTarget.scrollLeft += e.deltaY;
      }}
    >
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
              props.onTabChange?.();
            }}
            onMouseDown={() => startDrag(tab.id)}
            onMouseEnter={async () => {
              const dragged = draggedTabId();
              if (!dragged || dragged === tab.id) return;

              await moveTab(
                dragged,
                tabs()!.findIndex(([t]) => t.id === tab.id),
              );
              await refetchTabs();
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
                    setCurrentTab(null);
                    props.onTabChange?.();
                  }
              }}
            >
              <X class="w-3 h-3" />
            </div>
          </div>
        )}
      </For>

      <div
        class="flex items-center gap-1.5 px-3 py-1.5 text-sm text-subtext-0 hover:text-text cursor-pointer rounded-t select-none transition-colors shrink-0"
        onClick={props.onAddTab}
      >
        <Plus class="w-3.5 h-3.5" />
      </div>
    </div>
  );
}
