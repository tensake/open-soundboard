import { createResource, createSignal } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { SoundTab } from "./types";

export const [autoStartSignal, setAutoStartSignal] = createSignal(false);
export const [onboardedSignal, setOnboarded] = createSignal(true);
export const [normalizationSignal, setNormalizationSignal] =
  createSignal(false);

getAutoStart().then(setAutoStartSignal);
isOnboarded().then(setOnboarded);
getNormalization().then(setNormalizationSignal);

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
export async function setAutoStart(value: boolean) {
  setAutoStartSignal(value);
  await invoke("set_autostart", { enabled: value });
}
export async function getAutoStart(): Promise<boolean> {
  return await invoke("get_autostart");
}

/** Checks if the user has completed the onboarding. **/
export function isOnboarded(): Promise<boolean> {
  return invoke("is_onboarded");
}

/** Sets the onboarding status to completed. **/
export async function onboard() {
  await invoke("onboard");
  setOnboarded(true);
}

/** Toggles the normalization. **/
export async function setNormalization(n: boolean) {
  await invoke("set_normalize", { normalize: n });
  setNormalizationSignal(n);
}

/** Checks if the normalization is enabled. **/
export async function getNormalization(): Promise<boolean> {
  return await invoke("get_normalize");
}
