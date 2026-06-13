import type { Accessor, Setter } from "solid-js";
import { getMicVolume, setMicVolume } from "../lib";
import { onMount } from "solid-js";

interface SettingsProps {
  micVolumePct: Accessor<number>;
  setMicVolumePct: Setter<number>;
}

export default function Settings(props: SettingsProps) {
  onMount(async () => {
    const vol = await getMicVolume();
    props.setMicVolumePct(Math.round(vol * 100));
  });

  const handleMicVolume = (e: Event) => {
    const value = parseFloat((e.currentTarget as HTMLInputElement).value);
    props.setMicVolumePct(value);
    setMicVolume(value / 100);
  };

  return (
    <div class="flex flex-col gap-4 max-w-md">
      <h1 class="text-2xl font-bold">Settings</h1>
      <div>
        <h2 class="text-lg font-medium mb-1">Microphone Volume</h2>
        <input
          type="range"
          min="0"
          max="300"
          step="1"
          value={props.micVolumePct()}
          onInput={handleMicVolume}
          class="w-full cursor-pointer"
        />
        <span class="text-sm">{props.micVolumePct()}%</span>
      </div>
    </div>
  );
}
