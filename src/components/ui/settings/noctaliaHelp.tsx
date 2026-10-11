import { Show } from "solid-js";
import { noctaliaInstalled } from "../../../lib";

const CONFIG = `[theme.templates.user.open-soundboard]
input_path  = "$XDG_CONFIG_HOME/noctalia/templates/open-soundboard.css"
output_path = "$XDG_DATA_HOME/io.github.tensake.open-soundboard/style.css"
post_hook   = "pgrep -x open-soundboard >/dev/null && open-soundboard --reload-css"


`;

export default function NoctaliaHelp() {
  return (
    <Show when={noctaliaInstalled() === true}>
      <h2 class="text-lg mt-4">
        You have Noctalia?
      </h2>
      <div class="flex flex-col gap-3 mt-1">
        <p>
          Add this to your <code>~/.config/noctalia/templates.toml</code> config file.
          Noctalia will automatically change theme of the soundboard when it changes
          its color palette. Changes will appear in field above.
        </p>
        <pre class="bg-crust text-subtext-1 rounded-lg p-3 text-xs max-h-128 overflow-x-auto">
          <code>{CONFIG}</code>
        </pre>
      </div>
    </Show>
  );
}
