import { JSX, splitProps } from "solid-js";

export function Slider(props: JSX.InputHTMLAttributes<HTMLInputElement>) {
  const [local, rest] = splitProps(props, ["class"]);

  return (
    <input
      type="range"
      class={`slider${local.class ? ` ${local.class}` : ""}`}
      {...rest}
    />
  );
}
