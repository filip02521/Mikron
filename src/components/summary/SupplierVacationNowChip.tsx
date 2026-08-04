"use client";

import { cn } from "@/lib/cn";
import { IconSun } from "@/components/icons/StrokeIcons";
import {
  formatSupplierVacationRangeCompact,
  formatSupplierVacationRangeTitle,
  type SupplierOnVacationWindow,
} from "@/lib/orders/procurement-supplier-vacation";
import { PROCUREMENT_REQUEST_FLAG_COPY } from "@/lib/orders/procurement-request-flag-copy";
import { procurementStatusChipBaseClass } from "@/lib/ui/procurement-status-chips";

/** Read-only — stan dostawcy (nie edytowalna flaga zakupów). */
export function SupplierVacationNowChip({
  window,
  className,
  compact = false,
}: {
  window: SupplierOnVacationWindow;
  className?: string;
  /** Tylko ikona + „Urlop” (np. wąski kontekst linii). */
  compact?: boolean;
}) {
  const rangeCompact = formatSupplierVacationRangeCompact(window);
  const rangeTitle = formatSupplierVacationRangeTitle(window);
  return (
    <span
      className={cn(
        procurementStatusChipBaseClass,
        "border border-amber-200/70 bg-gradient-to-b from-amber-50 to-amber-50/70 text-amber-950 ring-amber-200/50",
        className
      )}
      title={`${PROCUREMENT_REQUEST_FLAG_COPY.vacationChip} · ${rangeTitle}`}
    >
      <IconSun size={11} strokeWidth={2.25} className="shrink-0 text-amber-600" aria-hidden />
      <span className="truncate">
        {PROCUREMENT_REQUEST_FLAG_COPY.vacationChipShort}
      </span>
      {!compact ? (
        <span className="hidden tabular-nums text-amber-800/75 sm:inline">
          {rangeCompact}
        </span>
      ) : null}
    </span>
  );
}
