import { createResource, createSignal } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { SoundFile, SoundTab } from "./types";

export const [autoStartSignal, setAutoStartSignal] = createSignal(false);
export const [onboardedSignal, setOnboarded] = createSignal(true);
export const [normalizationSignal, setNormalizationSignal] =
  createSignal(false);

getAutoStart().then(setAutoStartSignal);
isOnboarded().then(setOnboarded);
getNormalization().then(setNormalizationSignal);

export const [tabs, { refetch: refetchTabs }] = createResource(getTabs);
export const [currentTab, setCurrentTab] = createSignal<[SoundTab, SoundFile[]] | null>(null);
export const [customCss, { refetch: refetchCustomCss }] = createResource(() =>
  invoke<string>("get_custom_css"),
);

async function getTabs(): Promise<[SoundTab, SoundFile[]][]> {
  return invoke<[SoundTab, SoundFile[]][]>("get_tabs");
}

export async function getTab(id: string): Promise<[SoundTab, SoundFile[]] | null> {
  return invoke<[SoundTab, SoundFile[]] | null>("get_tab", { id });
}

export async function addTab(name: string, path: string) {
  await invoke("add_tab", { name, path });
  refetchTabs();
}

export async function removeTab(id: string) {
  await invoke("remove_tab", { id });
  refetchTabs();
}

export async function moveTab(id: string, idx: number) {
  await invoke("move_tab", { id, idx });
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
