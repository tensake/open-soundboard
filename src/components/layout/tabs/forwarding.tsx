import { createResource, For, Show, onMount, onCleanup } from "solid-js";
import {
  refreshAudioApps,
  forwardedApps,
  forwardApp,
  stopForward,
  setForwardVolume,
  AudioApp,
} from "../../../lib";
import { Square, SquareChevronRight } from "lucide-solid";
import { TransitionGroup } from "solid-transition-group";

function ForwardItem({ app }: { app: AudioApp }) {
  const forwarded = () => forwardedApps().find((a) => a.pid === app.id);
  return (
    <div class="flex items-center justify-between gap-4 rounded p-2 transition-colors duration-200 hover:bg-primary-400/10">
      <div class="flex items-center gap-3">
        {/* App Icon */}
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

        {/* Name */}
        <div class="flex flex-col">
          <span class="font-medium text-sm">
            {app.name || "Unknown Process"}
          </span>
          <span class="text-xs text-neutral-400">PID: {app.id}</span>
        </div>
      </div>

      {/* Controls */}
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
                class="cursor-pointer text-sm text-red-500 hover:text-red-400 bg-transparent border-none px-2 py-1 font-medium"
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

export default function Forwarding() {
  const [apps, { refetch }] = createResource(refreshAudioApps);

  // Refresh apps every 5 seconds
  onMount(() => {
    const interval = setInterval(() => {
      if (!apps.loading) {
        refetch();
        console.log("Apps refreshed");
      }
    }, 5000);

    onCleanup(() => clearInterval(interval));
  });

  return (
    <div class="flex h-full flex-col gap-2 p-4 overflow-y-auto">
      {/* Header */}
      <div class="flex flex-col mb-8 select-none">
        <h1 class="text-2xl font-bold mb-1">App forwarding</h1>
        <p class="text-sm text-subtext-1">
          Forward all outgoing audio from a specific app to virtual cable
        </p>
      </div>

      {/* Apps List */}
      <Show when={!apps.loading && apps()?.length === 0}>
        <div class="text-sm text-subtext-1">
          Could not find any apps that are currently playing any audio.
        </div>
      </Show>
      <TransitionGroup name="slide-down" appear>
        <div class="flex flex-col gap-1">
          <For each={apps()}>
            {(app) => {
              return <ForwardItem app={app} />;
            }}
          </For>
        </div>
      </TransitionGroup>
    </div>
  );
}
