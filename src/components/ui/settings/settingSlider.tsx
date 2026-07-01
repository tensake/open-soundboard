interface SettingSliderProps {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onInput: (e: InputEvent & { currentTarget: HTMLInputElement }) => void;
  valueLabel: string;
  maxWidth?: string;
}

export default function SettingSlider(props: SettingSliderProps) {
  return (
    <div class={props.maxWidth ?? "max-w-md"}>
      <h2 class="text-lg font-medium mb-1">{props.label}</h2>
      <input
        type="range"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        onInput={props.onInput}
        class="w-full cursor-pointer"
      />
      <span class="text-sm">{props.valueLabel}</span>
    </div>
  );
}
