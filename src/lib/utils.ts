export type Result<T, E> = { status: "ok"; data: T } | { status: "error"; error: E };

export function unwrap<T>(result: Result<T, string> | undefined): T | undefined {
  if (!result || result.status === "error") return undefined;
  return result.data;
}

export function unwrapOrThrow<T>(result: Result<T, string> | undefined): T {
  if (!result) throw new Error("Command returned no result");
  if (result.status === "error") throw new Error(result.error);
  return result.data;
}

export function formatTime(secs: number): string {
  if (!isFinite(secs) || secs < 0) return "0:00";
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
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

export function readableMilisecs(milisecs: number): string {
  if (!isFinite(milisecs) || milisecs < 0) return "0:00";
  const secs = Math.floor(milisecs / 1000);
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}
