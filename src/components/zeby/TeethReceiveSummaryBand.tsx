import { cn } from "@/lib/cn";
import { panelSubsectionInsetClass, panelTypography } from "@/lib/ui/ontime-theme";
import type { TeethReceiveInboxSummary } from "@/lib/orders/receive-queue-teeth";

export function TeethReceiveSummaryBand({
  summary,
  queueCount,
  className,
}: {
  summary: TeethReceiveInboxSummary;
  queueCount: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid gap-2 border-b border-slate-200/80 bg-slate-50/50 sm:grid-cols-2",
        panelSubsectionInsetClass,
        "py-3",
        className,
      )}
    >
      <div className="rounded-md border border-amber-200/80 bg-amber-50/50 px-3 py-2.5">
        <p className={cn(panelTypography.sectionLabel, "text-amber-800/90")}>W kolejce</p>
        <p className="mt-0.5 text-2xl font-semibold tabular-nums text-amber-950">{summary.activeCount}</p>
        <p className={cn(panelTypography.caption, "mt-0.5 text-amber-900/75")}>
          {queueCount === 0
            ? "Po oznaczeniu zamówienia w kolejce"
            : `${queueCount} ${queueCount === 1 ? "pozycja" : queueCount < 5 ? "pozycje" : "pozycji"} do rozliczenia`}
        </p>
      </div>
      <div className="rounded-md border border-slate-200/80 bg-white px-3 py-2.5">
        <p className={panelTypography.sectionLabel}>Częściowo przyjęte</p>
        <p className="mt-0.5 text-2xl font-semibold tabular-nums text-slate-900">
          {summary.partialCount}
        </p>
        <p className={cn(panelTypography.caption, "mt-0.5 text-slate-600")}>
          Uzupełnij brakującą ilość, gdy dostawa nie jest kompletna
        </p>
      </div>
    </div>
  );
}
