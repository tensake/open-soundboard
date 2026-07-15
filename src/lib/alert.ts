import { listen } from "@tauri-apps/api/event";
import { createSignal } from "solid-js";
import type { Alert } from "./types";

export const [alerts, setAlerts] = createSignal<Alert[]>([]);

export async function listenAlerts() {
  const unlisten_alert = await listen<Alert>("alert", (event) => {
    setAlerts((prev) => [...prev, event.payload]);
  });
  const unlisten_dismiss = await listen<string>("alert-dismiss", (event) => {
    setAlerts((prev) => prev.filter((a) => a.title !== event.payload));
  });
  return () => {
    unlisten_alert();
    unlisten_dismiss();
  };
}
