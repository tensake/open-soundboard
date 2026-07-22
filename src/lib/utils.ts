import { invoke } from "@tauri-apps/api/core";

export function formatTime(secs: number): string {
  if (!isFinite(secs) || secs < 0) return "0:00";
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

export async function markAsReady() {
  await invoke("mark_as_ready");
}

export async function clearAllCache() {
  await invoke("clear_all_cache");
}

export function readableBytes(bytes: number): string {
  if (bytes === 0) return "0 bytes";
  const units = ["bytes", "KB", "MB", "GB", "TB"];
  let unitIndex = 0;
  while (bytes >= 1024 && unitIndex < units.length - 1) {
    bytes /= 1024;
    unitIndex++;
  }
  return `${bytes.toFixed(2)} ${units[unitIndex]}`;
}

export function readableDate(unix: number): string {
  return new Date(unix * 1000).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}
