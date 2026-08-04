"use client";

import {
  collectProcurementSupplierBlockFlagLines,
  formatProcurementSupplierBlockCollapsedHint,
  formatProcurementSupplierBlockSummary,
  procurementProductCountLabel,
  procurementUnseenGroupsLabel,
  type ProcurementSupplierBlock,
} from "@/lib/orders/procurement-supplier-groups";
import { locationLabel } from "@/lib/display-labels";
import { PlannedOrderDateMeta } from "@/components/orders/PlannedOrderDateMeta";
import { Badge } from "@/components/ui/Badge";
import { IconChevronRight } from "@/components/icons/StrokeIcons";
import { cn } from "@/lib/cn";
import { ProcurementSupplierBlockActionBar } from "@/components/summary/ProcurementSupplierBlockActionBar";
import { ProcurementRequestFlagGroupChip } from "@/components/summary/ProcurementRequestFlagChip";
import { SupplierVacationNowChip } from "@/components/summary/SupplierVacationNowChip";
import type { DailyPanelRunFn } from "@/components/summary/useDailyPanelRunner";
import type { PlannedOrderDateDisplay } from "@/lib/orders/planned-order-date-label";
import type { ProcurementFlagDefinition } from "@/lib/orders/procurement-request-flag";
import type { SupplierOnVacationWindow } from "@/lib/orders/procurement-supplier-vacation";
import {
  controlFocusClass,
  dailyPanelUnseenBadgeClass,
  panelNameLinkClass,
  panelTypography,
  procurementSupplierBlockHeaderClass,
  rowPendingRingClass,
  type DailyPanelUnseenVariant,
} from "@/lib/ui/ontime-theme";
import { panelQueueRowLayoutClass } from "@/lib/ui/surfaces";

function Chevron({ open }: { open: boolean }) {
  return (
    <IconChevronRight
      size={16}
      strokeWidth={2.25}
      className={cn(
        "shrink-0 text-slate-500 transition-transform duration-200",
        open && "rotate-90"
      )}
      aria-hidden
    />
  );
}

export function ProcurementSupplierBlockBar({
  block,
  collapsed,
  onToggleCollapse,
  onOpenSupplier,
  leadTimeBrief,
  pending = false,
  run,
  unseenGroupCount,
  unseenVariant = "prosby",
  plannedOrderDate = null,
  vacationWindow = null,
  flagDefinitions = [],
  unseenPeopleNames,
}: {
  block: ProcurementSupplierBlock;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onOpenSupplier: (supplierId: string) => void;
  leadTimeBrief?: string | null;
  pending?: boolean;
  run: DailyPanelRunFn;
  unseenGroupCount?: number;
  /** Osoby z lokalnie niewidzianymi prośbami — musi być spójne z unseenGroupCount. */
  unseenPeopleNames?: string[];
  unseenVariant?: DailyPanelUnseenVariant;
  plannedOrderDate?: PlannedOrderDateDisplay | null;
  vacationWindow?: SupplierOnVacationWindow | null;
  flagDefinitions?: ProcurementFlagDefinition[];
}) {
  const summary = formatProcurementSupplierBlockSummary(block);
  const groupCount = block.requestGroups.length;
  const unseenCount = unseenGroupCount ?? block.unseenGroupCount;
  const productCount = procurementProductCountLabel(block.lineCount);
  const collapsedHint = formatProcurementSupplierBlockCollapsedHint(
    block,
    unseenCount,
    unseenPeopleNames
  );
  const flagLines = collapsed
    ? collectProcurementSupplierBlockFlagLines(block)
    : [];

  return (
    <div
      className={cn(
        procurementSupplierBlockHeaderClass(unseenVariant),
        pending && rowPendingRingClass
      )}
      aria-busy={pending}
    >
      <div className="px-2.5 py-2 sm:px-3">
        <div className={panelQueueRowLayoutClass}>
          <div className="flex min-w-0 flex-1 gap-2">
            <button
              type="button"
              onClick={onToggleCollapse}
              className={cn(
                "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white/60 ring-1 ring-slate-200/70",
                "text-slate-600 transition-colors hover:bg-white hover:text-slate-900",
                controlFocusClass
              )}
              aria-expanded={!collapsed}
              aria-label={
                collapsed
                  ? `Rozwiń ${groupCount} ${groupCount === 1 ? "prośbę" : groupCount < 5 ? "prośby" : "prośb"} u ${block.supplierName}`
                  : `Zwiń listę u ${block.supplierName}`
              }
            >
              <Chevron open={!collapsed} />
            </button>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  className={cn(panelTypography.rowTitle, panelNameLinkClass, "text-left")}
                  onClick={() => onOpenSupplier(block.supplierId)}
                >
                  {block.supplierName}
                </button>
                <Badge variant="default" className="text-[10px] font-medium">
                  {groupCount} {groupCount === 1 ? "prośba" : groupCount < 5 ? "prośby" : "prośb"}
                </Badge>
                {unseenCount > 0 ? (
                  <Badge
                    className={cn(
                      "px-1.5 py-0 text-[10px] font-semibold",
                      dailyPanelUnseenBadgeClass(unseenVariant)
                    )}
                  >
                    {unseenCount} {procurementUnseenGroupsLabel(unseenCount)}
                  </Badge>
                ) : null}
                {vacationWindow ? (
                  <SupplierVacationNowChip window={vacationWindow} compact />
                ) : null}
              </div>
              {collapsed ? (
                <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5">
                  <span className={cn(panelTypography.caption, "text-slate-500")}>
                    {collapsedHint}
                  </span>
                  {flagLines.some((l) => l.procurementFlag) ? (
                    <ProcurementRequestFlagGroupChip
                      lines={flagLines}
                      definitions={flagDefinitions}
                      disabled
                    />
                  ) : null}
                </div>
              ) : (
                <p className={cn("mt-0.5", panelTypography.rowMeta)}>
                  {locationLabel(block.location)}
                  {" · "}
                  {summary}
                </p>
              )}
              {leadTimeBrief ? (
                <p className={cn("mt-0.5", panelTypography.caption)}>{leadTimeBrief}</p>
              ) : null}
            </div>
          </div>
          <div className="flex w-full flex-col items-stretch gap-1.5 sm:w-auto sm:shrink-0 sm:items-end">
            {plannedOrderDate ? (
              <PlannedOrderDateMeta
                display={plannedOrderDate}
                className="self-start sm:self-auto"
              />
            ) : null}
            <span className={cn(panelTypography.caption, "font-medium text-slate-500 sm:text-right")}>
              Zamów razem · {productCount}
            </span>
            <ProcurementSupplierBlockActionBar block={block} pending={pending} run={run} />
          </div>
        </div>
      </div>
    </div>
  );
}
