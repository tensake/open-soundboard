import { createResource, createSignal, createMemo } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { SoundFile, SoundTab, SoundConfig, SoundTabKind } from "./types";

export const [autoStart, { mutate: mutateAutoStart, refetch: refetchAutoStart }] =
  createResource(() => invoke<boolean>("get_autostart"));
export const [onboarded, { mutate: mutateOnboarded, refetch: refetchOnboarded }] =
  createResource(() => invoke<boolean>("is_onboarded"));
export const [normalization, { mutate: mutateNormalization, refetch: refetchNormalization }] =
  createResource(() => invoke<boolean>("get_normalize"));

export const [tabs, { refetch: refetchTabs }] = createResource(getTabs);
export const [currentTab, setCurrentTab] = createSignal<[SoundTab, SoundFile[]] | null>(null);
export const currentTabPaths = createMemo(() =>
  currentTab()?.[1].map(f => f.path) ?? []
);
export const [customCss, { refetch: refetchCustomCss }] = createResource(() =>
  invoke<string>("get_custom_css"),
);

export const [soundsConfig, { refetch: refetchSoundsConfig }] = createResource(getSoundsConfig);

export const favouriteSounds = createMemo(() =>
  Object.keys(soundsConfig() ?? {}).filter(key =>
    soundsConfig()?.[key].tags?.includes("favourite")
  )
);

async function getTabs(): Promise<[SoundTab, SoundFile[]][]> {
  return invoke<[SoundTab, SoundFile[]][]>("get_tabs");
}

export async function getTab(id: string): Promise<[SoundTab, SoundFile[]] | null> {
  return invoke<[SoundTab, SoundFile[]] | null>("get_tab", { id });
}

export async function addTab(name: string, kind: SoundTabKind, path?: string) {
  await invoke("add_tab", { name, kind, path });
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

export async function editTab(tab: SoundTab): Promise<void> {
  await invoke("edit_tab", { tab });
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

export async function getSoundConfig(key: string): Promise<SoundConfig | null> {
  return invoke<SoundConfig | null>("get_sound_config", { key });
}

export async function setSoundConfig(key: string, config: SoundConfig): Promise<void> {
  return invoke<void>("set_sound_config", { key, config });
}

export async function getSoundsConfig(): Promise<Record<string, SoundConfig>> {
  return invoke<Record<string, SoundConfig>>("get_sounds_config");
}

export async function setAutoStart(value: boolean) {
  mutateAutoStart(value);
  await invoke("set_autostart", { enabled: value });
}
export async function getAutoStart(): Promise<boolean> {
  return await invoke("get_autostart");
}

export function isOnboarded(): Promise<boolean> {
  return invoke("is_onboarded");
}

export async function onboard() {
  await invoke("onboard");
  mutateOnboarded(true);
}

export async function setNormalization(n: boolean) {
  await invoke("set_normalize", { normalize: n });
  mutateNormalization(n);
}

export async function getNormalization(): Promise<boolean> {
  return await invoke("get_normalize");
}
