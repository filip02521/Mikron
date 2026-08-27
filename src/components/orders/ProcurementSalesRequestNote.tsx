import { cn } from "@/lib/cn";
import { panelTypography, salesRequestNoteLabelClass } from "@/lib/ui/ontime-theme";

/** Uwagi do prośby w panelu zakupów — od handlowca lub działu zakupów. */
export function ProcurementSalesRequestNote({
  note,
  className,
  compact = false,
}: {
  note: string;
  className?: string;
  compact?: boolean;
}) {
  const trimmed = note.trim();
  if (!trimmed) return null;

  return (
    <p
      className={cn(
        "flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5",
        panelTypography.rowMeta,
        compact && "text-[11px] leading-snug",
        className
      )}
    >
      <span className={salesRequestNoteLabelClass}>Uwagi</span>
      <span className="min-w-0 flex-1 whitespace-pre-wrap font-medium leading-snug text-slate-800">
        {trimmed}
      </span>
    </p>
  );
}
