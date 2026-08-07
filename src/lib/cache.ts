import { invoke } from "@tauri-apps/api/core";

export async function clearAllCache() {
  await invoke("clear_all_cache");
}

export async function getSoundsHistory(): Promise<Array<string>> {
  return await invoke("get_sounds_history");
}
