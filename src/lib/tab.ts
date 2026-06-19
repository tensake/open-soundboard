import { createResource } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { SoundTab } from "./types";

async function fetchTabs(): Promise<[SoundTab, string[]][]> {
  return invoke<[SoundTab, string[]][]>("get_tabs");
}

export const [tabs, { refetch: refetchTabs }] = createResource(fetchTabs);

export async function addTab(name: string, path: string) {
  await invoke("add_tab", { name, path });
  refetchTabs();
}

export async function removeTab(id: string) {
  await invoke("remove_tab", { id });
  refetchTabs();
}
