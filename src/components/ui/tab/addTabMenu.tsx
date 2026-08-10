import { createSignal, onCleanup, onMount, Show } from "solid-js";
import { FolderOpen, ListMusic, Plus } from "lucide-solid";

export default function AddTabMenu(props: {
  onAddDirectory: () => void;
  onAddUserTab: () => void;
}) {
  const [open, setOpen] = createSignal(false);
  let ref!: HTMLDivElement;

  const handleOutsideClick = (e: MouseEvent) => {
    if (!ref.contains(e.target as Node)) setOpen(false);
  };

  onMount(() => document.addEventListener("click", handleOutsideClick, true));
  onCleanup(() => document.removeEventListener("click", handleOutsideClick, true));

  return (
    <div ref={ref} class="relative">
      <button
        class="mx-1 flex items-center justify-center w-6 h-6 rounded text-subtext-0 hover:text-primary-400 transition-colors"
        onClick={() => setOpen(v => !v)}
        title="Add tab"
      >
        <Plus class="w-4 h-4" />
      </button>
      <Show when={open()}>
        <div class="fixed z-50 bg-mantle border border-surface-0 rounded-md shadow-lg overflow-hidden w-40">
          <button
            class="flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-surface-0 hover:text-primary-400 transition-colors"
            onClick={() => { props.onAddDirectory(); setOpen(false); }}
          >
            <FolderOpen class="w-3.5 h-3.5 shrink-0" />
            Add directory
          </button>
          <button
            class="flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-surface-0 hover:text-primary-400 transition-colors"
            onClick={() => { props.onAddUserTab(); setOpen(false); }}
          >
            <ListMusic class="w-3.5 h-3.5 shrink-0" />
            Add user tab
          </button>
        </div>
      </Show>
    </div>
  );
}
