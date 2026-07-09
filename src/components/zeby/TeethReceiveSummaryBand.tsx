"use client";

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
        "flex flex-wrap items-stretch gap-2",
        "-mx-3 px-3 py-2.5 sm:-mx-4 sm:px-4 lg:-mx-5 lg:px-5",
        className,
      )}
    >
      <div className="flex min-w-[8rem] flex-1 items-center gap-3 rounded-md border border-indigo-200/80 bg-indigo-50/50 px-3 py-2">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-indigo-100 text-indigo-700">
          <span className="text-sm font-bold tabular-nums">{summary.activeCount}</span>
        </div>
        <div className="min-w-0">
          <p className={cn(panelTypography.sectionLabel, "text-indigo-800/90")}>W kolejce</p>
          <p className={cn(panelTypography.caption, "truncate text-indigo-900/75")}>
            {queueCount === 0
              ? "Czeka na oznaczenie w kolejce"
              : `${queueCount} ${queueCount === 1 ? "pozycja" : queueCount < 5 ? "pozycje" : "pozycji"} do rozliczenia`}
          </p>
        </div>
      </div>
      <div className="flex min-w-[8rem] flex-1 items-center gap-3 rounded-md border border-amber-200/80 bg-amber-50/50 px-3 py-2">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-amber-100 text-amber-700">
          <span className="text-sm font-bold tabular-nums">{summary.partialCount}</span>
        </div>
        <div className="min-w-0">
          <p className={cn(panelTypography.sectionLabel, "text-amber-800/90")}>Częściowo</p>
          <p className={cn(panelTypography.caption, "truncate text-amber-900/75")}>
            Uzupełnij brakującą ilość
          </p>
        </div>
      </div>
    </div>
  );
}
