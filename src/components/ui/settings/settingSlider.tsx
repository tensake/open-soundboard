import { Slider } from "../slider";

interface SettingSliderProps {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onInput: (e: InputEvent & { currentTarget: HTMLInputElement }) => void;
  valueLabel: string;
  class?: string;
}

export default function SettingSlider(props: SettingSliderProps) {
  return (
    <div class={props.class ?? "max-w-md"}>
      <h2 class="text-md font-medium mb-1">{props.label}</h2>
      <Slider
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        onInput={props.onInput}
      />
      <span class="text-sm text-subtext-0">{props.valueLabel}</span>
    </div>
  );
}
