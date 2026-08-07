import { JSX, splitProps } from "solid-js";

export function Textarea(props: JSX.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const [local, rest] = splitProps(props, ["class", "children"]);

  return (
    <textarea
      class={`textarea${local.class ? ` ${local.class}` : ""}`}
      {...rest}
    >
      {local.children}
    </textarea>
  );
}
