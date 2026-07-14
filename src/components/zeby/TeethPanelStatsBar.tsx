"use client";

import { useMemo } from "react";
import { cn } from "@/lib/cn";
import { panelSubsectionInsetClass, panelTypography } from "@/lib/ui/ontime-theme";
import { teethQueueStatsBySupplier } from "@/lib/teeth/teeth-panel-filters";
import type { TeethQueueGroup } from "@/lib/data/teeth-queue";
import type { TeethPanelReadinessContext } from "@/lib/teeth/teeth-panel-order-readiness";
import { plProsba } from "@/lib/ui/polish-plurals";

export function TeethPanelStatsBar({
  groups,
  readinessCtx,
  className,
}: {
  groups: TeethQueueGroup[];
  readinessCtx?: TeethPanelReadinessContext;
  className?: string;
}) {
  const stats = useMemo(
    () => teethQueueStatsBySupplier(groups, readinessCtx),
    [groups, readinessCtx],
  );

  const entries = Array.from(stats.entries());
  if (entries.length === 0) return null;

  const totalPending = entries.reduce((sum, [, s]) => sum + s.pendingCount, 0);
  const totalMissing = entries.reduce((sum, [, s]) => sum + s.missingSpecCount, 0);

  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-md border border-slate-200/80 bg-slate-50/50 px-3 py-2", panelSubsectionInsetClass, className)}>
      <div className="flex items-center gap-1.5">
        <span className={cn(panelTypography.caption, "font-semibold text-slate-700")}>
          {totalPending} {plProsba(totalPending)}
        </span>
        <span className={panelTypography.caption}>oczekuje</span>
      </div>
      {totalMissing > 0 ? (
        <div className="flex items-center gap-1.5">
          <span className={cn(panelTypography.caption, "font-semibold text-amber-600")}>
            {totalMissing}
          </span>
          <span className={panelTypography.caption}>do uzupełnienia</span>
        </div>
      ) : null}
      <div className="h-3 w-px bg-slate-200" />
      {entries.map(([supplierId, s]) => {
        const group = groups.find((g) => g.supplierId === supplierId);
        const name = group?.supplierName ?? supplierId;
        return (
          <div key={supplierId} className="flex items-center gap-1.5">
            <span className={cn(panelTypography.caption, "font-medium text-slate-600")}>
              {name}:
            </span>
            <span className={cn(panelTypography.caption, "font-semibold text-slate-700")}>
              {s.pendingCount}
            </span>
            {s.missingSpecCount > 0 ? (
              <span className={cn(panelTypography.caption, "text-amber-600")}>
                ({s.missingSpecCount} brak)
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
