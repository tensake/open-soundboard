import { JSX, splitProps } from "solid-js";

export function Checkbox(props: JSX.InputHTMLAttributes<HTMLInputElement>) {
  const [local, rest] = splitProps(props, ["class"]);

  return (
    <input
      type="checkbox"
      class={`checkbox${local.class ? ` ${local.class}` : ""}`}
      {...rest}
    />
  );
}
