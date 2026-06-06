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
import { panelNameLinkClass, rowPendingRingClass } from "@/lib/ui/ontime-theme";

function Chevron({ open }: { open: boolean }) {
  return (
    <IconChevronRight
      size={16}
      strokeWidth={2.25}
      className={cn(
        "shrink-0 text-indigo-700 transition-transform",
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
}: {
  block: ProcurementSupplierBlock;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onOpenSupplier: (supplierId: string) => void;
  leadTimeBrief?: string | null;
  pending?: boolean;
  run: DailyPanelRunFn;
}) {
  const summary = formatProcurementSupplierBlockSummary(block);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-t-md border-b border-indigo-200/70 bg-gradient-to-b from-indigo-50/90 to-indigo-50/50",
        pending && rowPendingRingClass
      )}
      aria-busy={pending}
    >
      <div className="flex items-start gap-2 px-2.5 py-2 sm:px-3">
        <button
          type="button"
          onClick={onToggleCollapse}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-indigo-800 hover:bg-indigo-100/80"
          aria-expanded={!collapsed}
          aria-label={
            collapsed
              ? `Rozwiń prośby: ${block.supplierName}`
              : `Zwiń prośby: ${block.supplierName}`
          }
        >
          <Chevron open={!collapsed} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={cn(panelNameLinkClass, "text-sm font-bold text-indigo-950")}
              onClick={() => onOpenSupplier(block.supplierId)}
            >
              {block.supplierName}
            </button>
            {block.unseenGroupCount > 0 ? (
              <Badge variant="purple" className="px-1.5 py-0 text-[10px]">
                {block.unseenGroupCount}{" "}
                {procurementUnseenGroupsLabel(block.unseenGroupCount)}
              </Badge>
            ) : null}
          </div>
          <p className="mt-0.5 text-xs leading-snug text-indigo-900/85">
            {locationLabel(block.location)}
            {" · "}
            {summary}
          </p>
          {leadTimeBrief ? (
            <p className="mt-0.5 text-[10px] text-indigo-800/70">{leadTimeBrief}</p>
          ) : null}
        </div>
      </div>

      <div className="border-t border-indigo-200/60 bg-white/95 px-2.5 py-2 sm:px-3">
        <ProcurementSupplierBlockActionBar
          block={block}
          pending={pending}
          run={run}
          collapsed={collapsed}
        />
      </div>
    </div>
  );
}
