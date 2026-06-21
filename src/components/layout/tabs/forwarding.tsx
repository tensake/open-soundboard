import { createResource, For } from "solid-js";
import { getAudioApps } from "../../../lib";

export default function Forwarding() {
  const [apps] = createResource(getAudioApps);

  return (
    <div class="flex h-full flex-col">
      <h1>Apps with audio session</h1>

      {apps.loading && <div>Loading active audio sessions...</div>}

      <For each={apps()}>{(app) => <div class="p-1">PID: {app}</div>}</For>
    </div>
  );
}
