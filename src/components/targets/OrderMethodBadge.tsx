import {
  orderMethodKind,
  orderMethodLabel,
  type OrderMethodKind,
} from "@/lib/display-labels";
import { cn } from "@/lib/cn";

const STYLES: Record<OrderMethodKind, string> = {
  mail: "bg-sky-50 text-sky-800 border-sky-200",
  phone: "bg-amber-50 text-amber-900 border-amber-200",
  web: "bg-violet-50 text-violet-800 border-violet-200",
  other: "bg-slate-50 text-slate-600 border-slate-200",
};

const ICONS: Record<OrderMethodKind, string> = {
  mail: "✉",
  phone: "☎",
  web: "🌐",
  other: "·",
};

export function OrderMethodBadge({
  notes,
  className,
}: {
  notes: string;
  className?: string;
}) {
  const kind = orderMethodKind(notes);
  const label = orderMethodLabel(notes);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        STYLES[kind],
        className
      )}
      title={notes || label}
    >
      <span aria-hidden>{ICONS[kind]}</span>
      {label}
    </span>
  );
}
