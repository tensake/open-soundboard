import type { JSX } from "solid-js";

interface SettingToggleProps {
  title: string;
  description?: JSX.Element;
  checked: boolean;
  onInput: (e: InputEvent & { currentTarget: HTMLInputElement }) => void;
}

export default function SettingToggle(props: SettingToggleProps) {
  return (
    <div class="max-w-xl flex flex-col gap-2">
      <div class="flex items-center justify-between">
        <div class="flex flex-col items-start shrink-0 gap-1 max-w-lg">
          <h2 class="text-md">{props.title}</h2>
          {props.description && (
            <h3 class="text-sm text-subtext-0">{props.description}</h3>
          )}
        </div>
        <input
          type="checkbox"
          checked={props.checked}
          onInput={props.onInput}
        />
      </div>
    </div>
  );
}
