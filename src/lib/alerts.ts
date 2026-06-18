import { listen } from "@tauri-apps/api/event";
import { createSignal } from "solid-js";

export type AlertKind = "Warn" | "Error";

export interface Alert {
    kind: AlertKind;
    title: string;
    message: string;
}

export const [alerts, setAlerts] = createSignal<Alert[]>([]);

export async function listenAlerts() {
    return listen<Alert>("alert", (event) => {
        setAlerts(prev => [...prev, event.payload]);
    });
}
