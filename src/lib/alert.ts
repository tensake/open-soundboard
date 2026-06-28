import { listen } from "@tauri-apps/api/event";
import { createSignal } from "solid-js";
import type { Alert } from "./types";

export const [alerts, setAlerts] = createSignal<Alert[]>([]);

export async function listenAlerts() {
  return listen<Alert>("alert", (event) => {
    setAlerts((prev) => [...prev, event.payload]);
  });
}
