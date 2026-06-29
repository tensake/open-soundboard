import { Show } from "solid-js";
import { TriangleAlert, CircleX } from "lucide-solid";
import { Alert } from "../../lib";

export default function AlertItem(props: { alert: Alert }) {
  return (
    <div class="flex items-center gap-2.5 px-3.5 py-3 rounded-lg">
      <Show when={props.alert.kind === "Error"}>
        <CircleX size={24} class="text-error shrink-0 mt-0.5" />
      </Show>
      <Show when={props.alert.kind === "Warn"}>
        <TriangleAlert size={24} class="text-warn shrink-0 mt-0.5" />
      </Show>
      <div class="flex-1 min-w-0">
        <p class="text-sm font-bold text-foreground m-0 truncate">
          {props.alert.title}
        </p>
        <p class="text-xs mt-0.5 m-0 truncate text-subtext-0">
          {props.alert.message}
        </p>
      </div>
    </div>
  );
}
