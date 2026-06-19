import { Show } from "solid-js";
import { availableUpdate, updateProgress, installUpdate } from "../../lib";

export default function UpdateNotification() {
  return (
    <Show when={availableUpdate()}>
      {(update) => (
        <div
          onClick={updateProgress() > 0 ? undefined : installUpdate}
          class="py-2 px-4 text-sm cursor-pointer text-surface-0 hover:text-primary-400 transition-colors"
        >
          {updateProgress() > 0
            ? `Updating... Progress: ${Math.round(updateProgress() * 100)}%`
            : `New version is available! Click to update to ${update().version}.`}
        </div>
      )}
    </Show>
  );
}
