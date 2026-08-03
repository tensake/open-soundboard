import { createResource, For, Show, onMount, onCleanup } from "solid-js";
import {
  refreshAudioApps,
  forwardedApps,
  forwardApp,
  stopForward,
  setForwardVolume,
  AudioApp,
  soundVolumeSignal,
  micVolumeSignal,
  handleMicVolumeSlider,
  handleVolumeSlider,
} from "../../../lib";
import { Square, SquareChevronRight, AudioLines, Mic } from "lucide-solid";
import { TransitionGroup } from "solid-transition-group";
import SettingSlider from "../../ui/settings/settingSlider";

function ForwardItem({ app }: { app: AudioApp }) {
  const forwarded = () => forwardedApps().find((a) => a.pid === app.id);
  return (
    <div class="flex items-center justify-between gap-4 rounded-xl p-2 transition-colors duration-200 hover:bg-primary-400/10">
      <div class="flex items-center gap-3">
        <Show
          when={app.icon}
          fallback={
            <div class="w-8 h-8 rounded bg-crust flex items-center justify-center text-xl text-primary-400 select-none">
              {app.name?.[0] || "?"}
            </div>
          }
        >
          <img
            src={app.icon ? `data:image/png;base64,${app.icon}` : undefined}
            alt={app.name}
            class="w-8 h-8 object-contain rounded select-none"
          />
        </Show>

        <div class="flex flex-col">
          <span class="font-medium text-sm">
            {app.name || "Unknown Process"}
          </span>
          <span class="text-xs text-neutral-400">PID: {app.id}</span>
        </div>
      </div>

      <div class="flex items-center gap-2 select-none">
        <Show when={forwarded()}>
          {(fw) => (
            <>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={fw().volume}
                onInput={(e) =>
                  setForwardVolume(fw().id, parseFloat(e.currentTarget.value))
                }
                class="w-24 sm:w-32"
              />

              <button
                type="button"
                class="cursor-pointer text-sm bg-transparent border-none px-2 py-1 font-medium"
                onClick={() => stopForward(fw().id)}
              >
                <Square class="w-4 h-4" />
                Stop
              </button>
            </>
          )}
        </Show>

        <Show when={!forwarded()}>
          <button
            type="button"
            class="cursor-pointer text-sm text-primary-500 hover:text-primary-400 bg-transparent border-none px-2 py-1 font-medium"
            onClick={() => forwardApp(app.id)}
          >
            <SquareChevronRight class="w-4 h-4" /> Forward
          </button>
        </Show>
      </div>
    </div>
  );
}

export default function Audio() {
  const [apps, { refetch }] = createResource(refreshAudioApps);

  onMount(() => {
    const interval = setInterval(() => {
      if (!apps.loading && !apps.error) {
        refetch();
      }
    }, 5000);

    onCleanup(() => clearInterval(interval));
  });

  return (
    <div class="flex h-full flex-col gap-4 p-4 overflow-y-auto">
      <div class="grid grid-cols-2 gap-4">
        <div class="rounded-xl bg-mantle p-4 flex items-center gap-4">
          <AudioLines class="w-6 h-6 text-primary-400 shrink-0" />
          <div class="flex flex-col gap-2 flex-1 min-w-0">
            <SettingSlider
              label="Sound volume"
              min={0}
              max={100}
              step={1}
              value={soundVolumeSignal()}
              onInput={handleVolumeSlider}
              valueLabel={`${soundVolumeSignal()}%`}
            />
          </div>
        </div>

        <div class="rounded-xl bg-mantle p-4 flex items-center gap-4">
          <Mic class="w-6 h-6 text-primary-400 shrink-0" />
          <div class="flex flex-col gap-2 flex-1 min-w-0">
            <SettingSlider
              label="Microphone volume"
              min={0}
              max={300}
              step={1}
              value={micVolumeSignal()}
              onInput={handleMicVolumeSlider}
              valueLabel={`${micVolumeSignal()}%`}
            />
          </div>
        </div>
      </div>

      <div class="rounded-xl bg-mantle p-4 flex flex-col gap-2">
        <div class="mb-2 select-none">
          <span class="text-md font-medium text-subtext-1">Application sound forwarding</span>
        </div>

        <Show when={apps.error}>
          <span class="text-sm text-warn">{String(apps.error)}</span>
        </Show>

        <Show when={!apps.error}>
          <Show when={!apps.loading && apps()?.length === 0}>
            <div class="text-sm text-subtext-1">
              Could not find any apps that are currently playing any audio.
            </div>
          </Show>
          <TransitionGroup name="slide-down" appear>
            <div class="flex flex-col gap-1">
              <For each={apps()}>
                {(app) => <ForwardItem app={app} />}
              </For>
            </div>
          </TransitionGroup>
        </Show>
      </div>
    </div>
  );
}
