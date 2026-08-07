import { JSX, splitProps } from "solid-js";

export function Input(props: JSX.InputHTMLAttributes<HTMLInputElement>) {
  const [local, rest] = splitProps(props, ["class"]);

  return (
    <input
      class={`input${local.class ? ` ${local.class}` : ""}`}
      {...rest}
    />
  );
}
