import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import { createSignal } from "solid-js";

export const [permissionGranted, setPermissionGranted] = createSignal(false);

/**
 * Initialize notifications by checking the permission grant status and requesting it if needed.
 */
export async function initNotifications() {
  let permissionGranted = await isPermissionGranted();

  if (!permissionGranted) {
    const permission = await requestPermission();
    permissionGranted = permission === "granted";
    setPermissionGranted(permissionGranted);
  }
}

/**
 * Shows a notification to the user if the permission is granted, otherwise asks for it.
 */
export async function showNotification(title: string, body: string) {
  if (permissionGranted()) {
    sendNotification({ title, body });
  } else {
    await initNotifications();
    sendNotification({ title, body });
  }
}
