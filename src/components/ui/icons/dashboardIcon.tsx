import { pumpkin } from "@lucide/lab";
import { Cherry, Snowflake } from "lucide-solid";
import { Icon } from "lucide-solid";

export default function DashboardIcon(props: { class: string }) {
  const now = new Date();
  const month = now.getMonth();
  const date = now.getDate();

  // Halloween
  if ((month === 9 && date >= 20) || (month === 10 && date <= 3)) {
    return <Icon class={props.class} iconNode={pumpkin} />;
  }

  // Winter
  if ((month === 11 && date >= 19) || (month === 0 && date <= 5)) {
    return <Snowflake class={props.class} />;
  }

  // Default
  return <Cherry class={props.class} />;
}
