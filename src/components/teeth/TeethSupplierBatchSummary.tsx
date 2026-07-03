"use client";

import { TeethPanelSpecList } from "@/components/teeth/TeethPanelSpecList";
import { TeethProductLineBadge } from "@/components/teeth/TeethProductLineBadge";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import { panelSubsectionInsetClass, panelTypography } from "@/lib/ui/ontime-theme";
import { plPozycja } from "@/lib/ui/polish-plurals";
import type { TeethSupplierBatchSummary } from "@/lib/teeth/teeth-panel-aggregate";
import {
  teethPanelBatchLineBlockClass,
  teethPanelBatchStripClass,
  teethPanelIncompleteDetailClass,
  teethPanelIncompleteShellClass,
  teethPanelIncompleteTitleClass,
} from "@/lib/teeth/teeth-panel-ui";

/** Zbiorcza specyfikacja do zamówienia u dostawcy (wiersze poniżej = kto prosi). */
export function TeethSupplierBatchSummary({
  batch,
  className,
}: {
  batch: TeethSupplierBatchSummary;
  className?: string;
}) {
  if (batch.orderCount < 2) return null;

  const lineBlocks =
    batch.byProductLine.length > 0
      ? batch.byProductLine
      : batch.mergedGroups.length > 0
        ? [
            {
              productLine: null,
              productLineLabel: batch.productLineLabels[0] ?? "Do zamówienia",
              mergedGroups: batch.mergedGroups,
              totalPieces: batch.totalPieces,
              orderIds: [],
            },
          ]
        : [];

  return (
    <div className={cn(teethPanelBatchStripClass, className)}>
      <div className={cn("space-y-3 py-2.5", panelSubsectionInsetClass)}>
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className={panelTypography.rowTitle}>Do zamówienia u dostawcy</span>
          {batch.totalPieces > 0 ? (
            <span className={cn(panelTypography.caption, "text-slate-600")}>
              {batch.totalPieces} {plPozycja(batch.totalPieces)} · {batch.orderCount}{" "}
              {batch.orderCount === 1 ? "prośba" : batch.orderCount < 5 ? "prośby" : "prośb"}
            </span>
          ) : null}
          {batch.ordersMissingSpec > 0 ? (
            <Badge variant="warning" className="text-[10px]">
              {batch.ordersMissingSpec}{" "}
              {batch.ordersMissingSpec === 1 ? "do uzupełnienia" : "do uzupełnienia"}
            </Badge>
          ) : null}
        </div>

        {lineBlocks.length > 0 ? (
          <div className="space-y-2.5">
            {lineBlocks.map((block) => (
              <div
                key={`${block.productLineLabel}-${block.orderIds.join(",")}`}
                className={teethPanelBatchLineBlockClass}
              >
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  <TeethProductLineBadge
                    label={block.productLineLabel}
                    productLine={block.productLine}
                  />
                  {block.totalPieces > 0 ? (
                    <span className={cn(panelTypography.caption, "text-slate-500")}>
                      {block.totalPieces} {plPozycja(block.totalPieces)}
                    </span>
                  ) : null}
                </div>
                <TeethPanelSpecList groups={block.mergedGroups} compact />
              </div>
            ))}
          </div>
        ) : (
          <div className={cn(teethPanelIncompleteShellClass, "px-2.5 py-2")}>
            <p className={teethPanelIncompleteTitleClass}>Brak specyfikacji do scalenia</p>
            <p className={teethPanelIncompleteDetailClass}>
              Żadna z {batch.orderCount} prośb nie ma uzupełnionej listy zębów.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
