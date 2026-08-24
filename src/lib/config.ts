import { createResource, createSignal, createMemo } from "solid-js";
import { SoundFile, Tab } from "../bindings";
import { commands } from "../bindings";

export const [autoStart, { mutate: mutateAutoStart, refetch: refetchAutoStart }] =
  createResource(() => commands.getAutostart());
export const [onboarded, { mutate: mutateOnboarded, refetch: refetchOnboarded }] =
  createResource(() => commands.isOnboarded());
export const [normalization, { mutate: mutateNormalization, refetch: refetchNormalization }] =
  createResource(() => commands.getNormalize());
export const [tabs, { refetch: refetchTabs }] = createResource(commands.getTabs);
export const [currentTab, setCurrentTab] = createSignal<[Tab, SoundFile[]] | null>(null);
export const currentTabPaths = createMemo(() =>
  currentTab()?.[1].map(f => f.path) ?? []
);
export const [customCss, { refetch: refetchCustomCss }] = createResource(() =>
  commands.getCustomCss(),
);
export const [soundsConfig, { refetch: refetchSoundsConfig }] = createResource(commands.getSoundsConfig);
export const favouriteSounds = createMemo(() => {
  const config = soundsConfig();
  if (!config) return [];

  return Object.keys(config).filter(key => config[key]?.tags?.includes("favourite"));
});

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
  await commands.saveCustomCss(css);
  refetchCustomCss();
}

export async function setAutoStart(value: boolean) {
  mutateAutoStart({ status: "ok", data: value });
  await commands.setAutostart(value);
}

export async function getAutoStart(): Promise<boolean> {
  let result = await commands.getAutostart();
  if (result.status === "error") throw result.error;
  return result.data;
}

export function isOnboarded(): Promise<boolean> {
  return commands.isOnboarded();
}

export async function onboard() {
  await commands.onboard();
  mutateOnboarded(true);
}

export async function setNormalization(n: boolean) {
  await commands.setNormalize(n);
  mutateNormalization(n);
}
