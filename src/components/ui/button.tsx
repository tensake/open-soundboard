import { JSX, splitProps } from "solid-js";

export function Button(props: JSX.ButtonHTMLAttributes<HTMLButtonElement>) {
  const [local, rest] = splitProps(props, ["class", "children"]);

  return (
    <button
      class={`btn${local.class ? ` ${local.class}` : ""}`}
      {...rest}
    >
      {local.children}
    </button>
  );
}
