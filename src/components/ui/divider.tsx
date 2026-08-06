import { JSX, splitProps } from "solid-js";

export function Divider(props: JSX.HTMLAttributes<HTMLHRElement>) {
  const [local, rest] = splitProps(props, ["class"]);

  return (
    <hr
      class={`divider${local.class ? ` ${local.class}` : ""}`}
      {...rest}
    />
  );
}
