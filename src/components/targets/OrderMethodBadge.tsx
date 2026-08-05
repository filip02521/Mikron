import {
  orderMethodKind,
  orderMethodLabel,
  type OrderMethodKind,
} from "@/lib/display-labels";
import { cn } from "@/lib/cn";
import {
  IconGlobe,
  IconMail,
  IconPhone,
  type StrokeIconProps,
} from "@/components/icons/StrokeIcons";

const STYLES: Record<OrderMethodKind, string> = {
  mail: "bg-sky-50 text-sky-800 border-sky-200",
  phone: "bg-amber-50 text-amber-900 border-amber-200",
  web: "bg-violet-50 text-violet-800 border-violet-200",
  other: "bg-slate-50 text-slate-600 border-slate-200",
};

const ICONS: Record<
  OrderMethodKind,
  ((props: StrokeIconProps) => React.ReactElement) | null
> = {
  mail: IconMail,
  phone: IconPhone,
  web: IconGlobe,
  other: null,
};

export function OrderMethodBadge({
  notes,
  className,
  onClick,
  title,
  pressedLabel,
}: {
  notes: string;
  className?: string;
  /** Gdy podane — badge jest przyciskiem (np. kopiuj e-mail). */
  onClick?: () => void;
  title?: string;
  /** Tekst zamiast etykiety metody (np. „Skopiowano”). */
  pressedLabel?: string | null;
}) {
  const kind = orderMethodKind(notes);
  const label = orderMethodLabel(notes);
  const Icon = ICONS[kind];
  const displayLabel = pressedLabel?.trim() || label;

  const shellClass = cn(
    "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
    STYLES[kind],
    onClick &&
      "cursor-pointer transition-[filter,box-shadow] hover:brightness-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/40",
    pressedLabel && "ring-2 ring-emerald-400/70",
    className
  );

  const body = (
    <>
      {Icon ? <Icon size={14} className="shrink-0 opacity-90" /> : null}
      {displayLabel}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        className={shellClass}
        title={title ?? (notes || label)}
        onClick={onClick}
      >
        {body}
      </button>
    );
  }

  return (
    <span className={shellClass} title={title ?? (notes || label)}>
      {body}
    </span>
  );
}
