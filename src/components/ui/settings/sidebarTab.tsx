interface SidebarTabProps {
  label: string;
  active: boolean;
  onClick: () => void;
}

export default function SidebarTab(props: SidebarTabProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={props.onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          props.onClick();
        }
      }}
      class={`select-none cursor-pointer px-3 py-1.5 rounded-md text-sm font-medium transition-colors duration-200 hover:bg-primary-400/10 ${
        props.active ? "text-primary-400" : "text-subtext-1"
      }`}
    >
      {props.label}
    </div>
  );
}
