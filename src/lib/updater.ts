import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { createSignal } from "solid-js";

export const [availableUpdate, setAvailableUpdate] =
  createSignal<Update | null>(null);
export const [updateProgress, setUpdateProgress] = createSignal(0);

export async function checkForUpdate() {
  try {
    const update = await check();
    if (update) setAvailableUpdate(update);
  } catch (e) {
    console.error("Update check failed", e);
  }
}

export async function installUpdate() {
  const update = availableUpdate();
  if (!update) return;

  let downloaded = 0;
  let contentLength = 0;
  setUpdateProgress(1);
  try {
    await update.downloadAndInstall((e) => {
      switch (e.event) {
        case "Started":
          contentLength = e.data.contentLength || 0;
          break;
        case "Progress":
          downloaded += e.data.chunkLength;
          setUpdateProgress(downloaded / contentLength);
          console.log(`Downloaded ${downloaded} from ${contentLength}`);
          break;
      }
    });

    console.log("Update installed");
    await relaunch();
  } catch (e) {
    console.error("Update install failed", e);
    setUpdateProgress(0);
  }
}
