import { cn } from "@/lib/cn";
import { panelTypography } from "@/lib/ui/ontime-theme";
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
        "grid gap-2 bg-slate-50/50 sm:grid-cols-2",
        "-mx-3 px-3 py-3 sm:-mx-4 sm:px-4 lg:-mx-5 lg:px-5",
        className,
      )}
    >
      <div className="rounded-md border border-indigo-200/80 bg-indigo-50/50 px-3 py-2.5">
        <p className={cn(panelTypography.sectionLabel, "text-indigo-800/90")}>W kolejce</p>
        <p className="mt-0.5 text-2xl font-semibold tabular-nums text-indigo-950">{summary.activeCount}</p>
        <p className={cn(panelTypography.caption, "mt-0.5 text-indigo-900/75")}>
          {queueCount === 0
            ? "Po oznaczeniu zamówienia w kolejce"
            : `${queueCount} ${queueCount === 1 ? "pozycja" : queueCount < 5 ? "pozycje" : "pozycji"} do rozliczenia`}
        </p>
      </div>
      <div className="rounded-md border border-amber-200/80 bg-amber-50/50 px-3 py-2.5">
        <p className={cn(panelTypography.sectionLabel, "text-amber-800/90")}>Częściowo przyjęte</p>
        <p className="mt-0.5 text-2xl font-semibold tabular-nums text-amber-950">
          {summary.partialCount}
        </p>
        <p className={cn(panelTypography.caption, "mt-0.5 text-amber-900/75")}>
          Uzupełnij brakującą ilość, gdy dostawa nie jest kompletna
        </p>
      </div>
    </div>
  );
}
