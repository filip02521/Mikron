"use client";

import {
  OverflowMenu,
  OverflowMenuItem,
  OverflowMenuLabel,
} from "@/components/ui/OverflowMenu";
import {
  IconChevronDown,
  IconTruck,
} from "@/components/icons/StrokeIcons";
import { panelToolbarTextButtonClass } from "@/lib/ui/ontime-theme";
import {
  ZD_ESTIMATE_UI,
  zdEstimateSuppliersMenuAriaLabel,
  zdEstimateSuppliersScopesItemSuffix,
  zdEstimateSuppliersUnmappedBadge,
} from "@/lib/orders/zd-estimate-ui-copy";

export type ZdEstimateSuppliersMenuProps = {
  todayUnmappedCount: number;
  onOpenScopes: () => void;
  onOpenSnapshots: () => void;
  disabled?: boolean;
  compact?: boolean;
};

/**
 * Operacje dostawców / ZD — osobno od „Reguły listy” (wykluczenia, opakowania…).
 */
export function ZdEstimateSuppliersMenu({
  todayUnmappedCount,
  onOpenScopes,
  onOpenSnapshots,
  disabled,
  compact = false,
}: ZdEstimateSuppliersMenuProps) {
  const hasUnmapped = todayUnmappedCount > 0;
  const ariaLabel = zdEstimateSuppliersMenuAriaLabel(todayUnmappedCount);

  return (
    <OverflowMenu
      label={ariaLabel}
      triggerLabel={
        <>
          <span>{ZD_ESTIMATE_UI.suppliersMenuTrigger}</span>
          {hasUnmapped ? (
            <span
              className="inline-flex max-w-[9.75rem] items-center truncate rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums tracking-tight text-amber-950"
              title={zdEstimateSuppliersUnmappedBadge(todayUnmappedCount)}
            >
              {zdEstimateSuppliersUnmappedBadge(todayUnmappedCount, {
                compact,
              })}
            </span>
          ) : null}
        </>
      }
      triggerLeading={
        <IconTruck size={15} strokeWidth={2} className="shrink-0 opacity-90" />
      }
      triggerTrailing={
        <IconChevronDown
          size={14}
          strokeWidth={2.25}
          className="shrink-0 opacity-70"
        />
      }
      align="end"
      disabled={disabled}
      triggerClassName={panelToolbarTextButtonClass}
      menuClassName="min-w-[16rem]"
    >
      <OverflowMenuLabel>Mapowania i historia</OverflowMenuLabel>
      <OverflowMenuItem disabled={disabled} onClick={onOpenScopes}>
        <span className="flex flex-col gap-0.5">
          <span className="font-medium text-slate-900">
            {ZD_ESTIMATE_UI.supplierScopesPanelTitle}
            {zdEstimateSuppliersScopesItemSuffix(todayUnmappedCount)}
          </span>
          <span className="text-[11px] font-normal leading-snug text-slate-500">
            Dostawca ↔ grupa lub cecha Subiekta
          </span>
        </span>
      </OverflowMenuItem>
      <OverflowMenuItem disabled={disabled} onClick={onOpenSnapshots}>
        <span className="flex flex-col gap-0.5">
          <span className="font-medium text-slate-900">
            {ZD_ESTIMATE_UI.snapshotsModalTitle}
          </span>
          <span className="text-[11px] font-normal leading-snug text-slate-500">
            Korekta kolejnych list z zapisanych ZD
          </span>
        </span>
      </OverflowMenuItem>
    </OverflowMenu>
  );
}
