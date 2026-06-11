"use client";

import {
  formatProcurementSupplierBlockSummary,
  procurementUnseenGroupsLabel,
  type ProcurementSupplierBlock,
} from "@/lib/orders/procurement-supplier-groups";
import { locationLabel } from "@/lib/display-labels";
import { Badge } from "@/components/ui/Badge";
import { IconChevronRight } from "@/components/icons/StrokeIcons";
import { cn } from "@/lib/cn";
import { ProcurementSupplierBlockActionBar } from "@/components/summary/ProcurementSupplierBlockActionBar";
import type { DailyPanelRunFn } from "@/components/summary/useDailyPanelRunner";
import {
  dailyPanelUnseenBadgeClass,
  panelNameLinkClass,
  panelTypography,
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
        "shrink-0 text-slate-500 transition-transform",
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
}: {
  block: ProcurementSupplierBlock;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onOpenSupplier: (supplierId: string) => void;
  leadTimeBrief?: string | null;
  pending?: boolean;
  run: DailyPanelRunFn;
  /** Lokalnie nieprzeczytane (domyślnie z serwera). */
  unseenGroupCount?: number;
  unseenVariant?: DailyPanelUnseenVariant;
}) {
  const summary = formatProcurementSupplierBlockSummary(block);
  const groupCount = block.requestGroups.length;
  const unseenCount = unseenGroupCount ?? block.unseenGroupCount;

  return (
    <div
      className={cn(
        "border-b border-slate-200/90 bg-slate-50/50",
        pending && rowPendingRingClass
      )}
      aria-busy={pending}
    >
      <div className="px-2 py-2">
        <div className={panelQueueRowLayoutClass}>
          <div className="flex min-w-0 flex-1 gap-2">
            <button
              type="button"
              onClick={onToggleCollapse}
              className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-600 transition-colors hover:bg-slate-200/60 hover:text-slate-900"
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
                <Badge variant="default" className="text-[10px]">
                  {groupCount} {groupCount === 1 ? "osoba" : groupCount < 5 ? "osoby" : "osób"}
                </Badge>
                {unseenCount > 0 ? (
                  <Badge
                    className={cn(
                      "px-1.5 py-0 text-[10px] font-semibold",
                      dailyPanelUnseenBadgeClass(unseenVariant)
                    )}
                  >
                    {unseenCount}{" "}
                    {procurementUnseenGroupsLabel(unseenCount)}
                  </Badge>
                ) : null}
                {collapsed ? (
                  <span className={cn(panelTypography.caption, "text-slate-500")}>
                    lista zwinięta
                  </span>
                ) : null}
              </div>
              <p className={cn("mt-0.5", panelTypography.rowMeta)}>
                {locationLabel(block.location)}
                {" · "}
                {summary}
              </p>
              {leadTimeBrief ? (
                <p className={cn("mt-0.5", panelTypography.caption)}>{leadTimeBrief}</p>
              ) : null}
            </div>
          </div>
          <div className="w-full sm:w-auto sm:shrink-0 sm:self-start">
            <ProcurementSupplierBlockActionBar
              block={block}
              pending={pending}
              run={run}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
