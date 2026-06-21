import { invoke } from "@tauri-apps/api/core";

export async function getAudioApps(): Promise<number[]> {
    return await invoke("get_audio_apps");
}
