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
        panelTypography.rowMeta,
        compact && "text-[11px] leading-snug",
        className
      )}
    >
      <span className={salesRequestNoteLabelClass}>Uwagi</span>{" "}
      <span className="whitespace-pre-wrap font-medium text-slate-800">{trimmed}</span>
    </p>
  );
}
