import { createSignal, For, Show } from "solid-js";
import { Folder, FolderOpen, X, ListMusic, Heart } from "lucide-solid";
import AddTabMenu from "./addTabMenu";
import {
  tabs,
  removeTab,
  editTab,
  moveTab,
  refetchTabs,
  currentTab,
  setCurrentTab,
} from "../../../lib";
import { SoundFile, Tab } from "../../../bindings";

interface TabGroupProps {
  onAddTab?: () => void;
  onAddUserTab?: () => void;
  onTabChange?: () => void;
}

export default function TabGroup(props: TabGroupProps) {
  const [draggedTabId, setDraggedTabId] = createSignal<string | null>(null);
  const [editingTabId, setEditingTabId] = createSignal<string | null>(null);
  const [editingName, setEditingName] = createSignal("");

  const isCurrentTab = (tab: Tab) => currentTab()?.[0].id === tab.id;

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
        {([tab, sounds]: [Tab, SoundFile[]]) => (
          <div
            class={`group flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer rounded-t select-none transition-colors shrink-0 w-36 ${
              isCurrentTab(tab)
                ? "bg-enabled text-primary-400"
                : "bg-disabled text-subtext-0 hover:bg-enabled hover:text-subtext-1"
            }`}
            onClick={async () => {
              {/* Start editing name if current */}
              if (isCurrentTab(tab)) {
                setEditingTabId(tab.id);
                setEditingName(tab.name);
                return;
              }

              {/* Set as current tab */}
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
              ? <Show when={tab.kind === "user"} fallback={
                  <Show when={tab.kind === "favourite"} fallback={<FolderOpen class="w-3.5 h-3.5 shrink-0" />}>
                    <Heart class="w-3.5 h-3.5 shrink-0 fill-primary-400" />
                  </Show>
                }>
                  <ListMusic class="w-3.5 h-3.5 shrink-0 fill-primary-400" />
                </Show>
              : <Show when={tab.kind === "user"} fallback={
                  <Show when={tab.kind === "favourite"} fallback={<Folder class="w-3.5 h-3.5 shrink-0" />}>
                    <Heart class="w-3.5 h-3.5 shrink-0" />
                  </Show>
                }>
                  <ListMusic class="w-3.5 h-3.5 shrink-0" />
                </Show>
            }
            <Show when={editingTabId() === tab.id} fallback={
              <span class="truncate flex-1">{tab.name}</span>
            }>
              <input
                class="truncate flex-1 bg-transparent outline-none text-sm w-0 min-w-0"
                value={editingName()}
                onInput={(e) => setEditingName(e.currentTarget.value)}
                onKeyDown={async (e) => {
                  if (e.key === "Enter" || e.key === "Escape") {
                    e.currentTarget.blur();
                  }
                }}
                onBlur={async () => {
                  const name = editingName().trim() || tab.name;
                  await editTab({ ...tab, name });
                  setEditingTabId(null);
                }}
                ref={(el) => setTimeout(() => el?.focus(), 0)}
              />
            </Show>
            <Show when={tab.kind !== "favourite"}>
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
            </Show>
          </div>
        )}
      </For>

      <AddTabMenu
        onAddDirectory={() => props.onAddTab?.()}
        onAddUserTab={() => props.onAddUserTab?.()}
      />
    </div>
  );
}
