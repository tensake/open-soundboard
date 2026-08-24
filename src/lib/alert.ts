import { createSignal } from "solid-js";
import { events } from "../bindings";
import type { Alert } from "../bindings";

export const [alerts, setAlerts] = createSignal<Alert[]>([]);

export async function listenAlerts() {
  const unlisten_alert = await events.alertEvent.listen((e) => {
    setAlerts((prev) => [...prev, e.payload]);
  });

  const unlisten_dismiss = await events.alertDismissEvent.listen((e) => {
    setAlerts((prev) => prev.filter((a) => a.title !== e.payload));
  });
  return () => {
    unlisten_alert();
    unlisten_dismiss();
  };
}
