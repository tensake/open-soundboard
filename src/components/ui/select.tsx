import { JSX, splitProps } from "solid-js";

export function Select(props: JSX.SelectHTMLAttributes<HTMLSelectElement>) {
  const [local, rest] = splitProps(props, ["class", "children"]);

  return (
    <select
      class={`select${local.class ? ` ${local.class}` : ""}`}
      {...rest}
    >
      {local.children}
    </select>
  );
}
