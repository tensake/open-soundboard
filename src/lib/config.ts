import { createResource } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { SoundTab } from "./types";

async function fetchTabs(): Promise<[SoundTab, string[]][]> {
  return invoke<[SoundTab, string[]][]>("get_tabs");
}

export const [tabs, { refetch: refetchTabs }] = createResource(fetchTabs);
export const [customCss, { refetch: refetchCustomCss }] = createResource(() =>
  invoke<string>("get_custom_css"),
);

export async function addTab(name: string, path: string) {
  await invoke("add_tab", { name, path });
  refetchTabs();
}

export async function removeTab(id: string) {
  await invoke("remove_tab", { id });
  refetchTabs();
}

export function applyCustomCss(css: string) {
  const existing = document.getElementById("custom-css");
  if (existing) existing.remove();

  const style = document.createElement("style");
  style.id = "custom-css";
  style.textContent = css;
  document.head.appendChild(style);
}

export async function saveCustomCss(css: string) {
  applyCustomCss(css);
  await invoke("save_custom_css", { css });
  refetchCustomCss();
}
