import { JSX, createSignal } from "solid-js";

interface ProgressSliderProps {
  value?: number;
  min?: number;
  max?: number;
  step?: number;
  onChange?: (value: number) => void;
  inputProps?: JSX.InputHTMLAttributes<HTMLInputElement>;
}

export default function ProgressSlider(props: ProgressSliderProps) {
  const [hovered, setHovered] = createSignal(false);
  const min = () => props.min ?? 0;
  const max = () => props.max ?? 100;
  const value = () => props.value ?? 0;

  return (
    <div
      class="group relative flex items-center w-full h-4 cursor-pointer"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Full slider */}
      <div class="absolute inset-x-0 h-1 rounded-full bg-surface-0 overflow-visible">
        {/* Slider progress */}
        <div
          class="h-full rounded-full bg-subtext-0 group-hover:bg-primary-400 transition-colors duration-150"
          style={{ width: `${value() / max() * 100}%` }}
        />
      </div>

      {/* Range input */}
      <input
        type="range"
        {...props.inputProps}
        min={min()}
        max={max()}
        step={props.step ?? 1}
        value={value()}
        onInput={(e) => props.onChange?.(Number(e.target.value))}
        class={`progress-slider ${hovered() ? "progress-slider-thumb-visible" : ""}`}
      />
    </div>
  );
}
