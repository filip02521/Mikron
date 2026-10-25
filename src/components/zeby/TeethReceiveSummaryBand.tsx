"use client";

import { cn } from "@/lib/cn";
import { plPozycja } from "@/lib/ui/polish-plurals";
import type { TeethReceiveInboxSummary } from "@/lib/orders/receive-queue-teeth";

/** Zdanie stanu przyjęcia (DESIGN.md → Status Panel); przy pustej kolejce mówi to pusty stan. */
export function TeethReceiveSummaryBand({
  summary,
  queueCount,
  className,
}: {
  summary: TeethReceiveInboxSummary;
  queueCount: number;
  className?: string;
}) {
  if (queueCount === 0) return null;
  return (
    <p className={cn("text-sm text-slate-600 tabular-nums", className)}>
      <span className="font-semibold text-slate-900">
        {queueCount} {plPozycja(queueCount)} do przyjęcia
      </span>
      {summary.partialCount > 0 ? (
        <span className="text-amber-800">
          {" "}
          · {summary.partialCount} częściowo - uzupełnij brakującą ilość
        </span>
      ) : null}
    </p>
  );
}
