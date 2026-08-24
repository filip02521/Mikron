"use client";

import {
  collectProcurementSupplierBlockFlagLines,
  formatProcurementSupplierBlockCollapsedHint,
  formatProcurementSupplierBlockSummary,
  procurementBlockGroupCountLabel,
  procurementBlockGroupCountPhrase,
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
import { ProcurementRequestActionsFooter } from "@/components/summary/ProcurementRequestActionsFooter";
import { ProcurementRequestFlagGroupChip } from "@/components/summary/ProcurementRequestFlagChip";
import { SupplierVacationNowChip } from "@/components/summary/SupplierVacationNowChip";
import type { DailyPanelRunFn } from "@/components/summary/useDailyPanelRunner";
import type { PlannedOrderDateDisplay } from "@/lib/orders/planned-order-date-label";
import type { ProcurementFlagDefinition } from "@/lib/orders/procurement-request-flag";
import type { SupplierOnVacationWindow } from "@/lib/orders/procurement-supplier-vacation";
import {
  controlFocusClass,
  dailyPanelUnseenBadgeClass,
  panelTypography,
  procurementSupplierBlockHeaderClass,
  rowPendingRingClass,
  type DailyPanelUnseenVariant,
} from "@/lib/ui/ontime-theme";
import {
  panelRowClearFocusOnLeave,
  panelRowGroupClass,
} from "@/lib/ui/panel-row-actions-reveal";
import {
  ProcurementRequestCardHeader,
  ProcurementRequestContextBlock,
  ProcurementRequestContextMetaItem,
} from "@/components/summary/ProcurementRequestCardZones";
import {
  procurementRequestCardBodyClass,
  procurementRequestFooterScopeLabelClass,
  procurementSupplierBlockFooterClass,
  procurementSupplierNameLinkClass,
} from "@/components/summary/procurement-request-row-styles";

function Chevron({ open }: { open: boolean }) {
  return (
    <IconChevronRight
      size={14}
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
  headerActionHint = "expand-all",
}: {
  block: ProcurementSupplierBlock;
  collapsed: boolean;
  /** FSM: rozwiń wszystko → produkty → zwiń blok/produkty. */
  onToggleCollapse: () => void;
  onOpenSupplier: (supplierId: string) => void;
  leadTimeBrief?: string | null;
  pending?: boolean;
  run: DailyPanelRunFn;
  unseenGroupCount?: number;
  unseenPeopleNames?: string[];
  unseenVariant?: DailyPanelUnseenVariant;
  plannedOrderDate?: PlannedOrderDateDisplay | null;
  vacationWindow?: SupplierOnVacationWindow | null;
  flagDefinitions?: ProcurementFlagDefinition[];
  headerActionHint?:
    | "expand-all"
    | "expand-products"
    | "collapse-block"
    | "collapse-products";
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
  const locationSummary = `${locationLabel(block.location)} · ${summary}`;
  const hasCollapsedFlags = flagLines.some((l) => l.procurementFlag);
  const isStockOut = unseenVariant === "stockOut";
  const groupKind = isStockOut ? "signal" : "request";
  const groupCountBadge = procurementBlockGroupCountLabel(groupCount, groupKind);
  const groupCountPhrase = procurementBlockGroupCountPhrase(groupCount, groupKind);

  const headerActionTitle =
    headerActionHint === "expand-all"
      ? "Kliknij: rozwiń grupę i produkty"
      : headerActionHint === "expand-products"
        ? "Kliknij: pokaż wszystkie produkty"
        : headerActionHint === "collapse-block"
          ? "Kliknij: zwiń grupę"
          : "Kliknij: zwiń produkty";
  const headerActionLabel =
    headerActionHint === "expand-all"
      ? "· rozwiń wszystko"
      : headerActionHint === "expand-products"
        ? "· pokaż produkty"
        : headerActionHint === "collapse-block"
          ? "· zwiń grupę"
          : "· zwiń produkty";
  const chevronAria =
    headerActionHint === "expand-all"
      ? `Rozwiń ${groupCountPhrase} i produkty u ${block.supplierName}`
      : headerActionHint === "expand-products"
        ? `Pokaż wszystkie produkty u ${block.supplierName}`
        : headerActionHint === "collapse-block"
          ? `Zwiń grupę u ${block.supplierName}`
          : `Zwiń produkty u ${block.supplierName}`;

  return (
    <div
      className={cn(
        panelRowGroupClass(procurementSupplierBlockHeaderClass(unseenVariant)),
        pending && rowPendingRingClass
      )}
      aria-busy={pending}
      onMouseLeave={panelRowClearFocusOnLeave}
    >
      <div
        className={cn(
          procurementRequestCardBodyClass,
          "group/blockHeader cursor-pointer transition-colors",
          collapsed
            ? isStockOut
              ? "hover:bg-amber-50/55"
              : "hover:bg-indigo-50/45"
            : isStockOut
              ? "hover:bg-amber-50/35"
              : "hover:bg-indigo-50/30"
        )}
        title={headerActionTitle}
        onClick={(e) => {
          const t = e.target as HTMLElement;
          if (
            t.closest(
              "button, a, [role='button'], input, textarea, select, [data-no-card-toggle]"
            )
          ) {
            return;
          }
          onToggleCollapse();
        }}
      >
        <div className="flex min-w-0 gap-1.5">
          <button
            type="button"
            onClick={onToggleCollapse}
            className={cn(
              "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/70 ring-1 ring-slate-200/70",
              "text-slate-600 transition-colors hover:bg-white hover:text-slate-900",
              controlFocusClass,
              collapsed
                ? isStockOut
                  ? "group-hover/blockHeader:ring-amber-300/80 group-hover/blockHeader:text-amber-800"
                  : "group-hover/blockHeader:ring-indigo-300/80 group-hover/blockHeader:text-indigo-700"
                : isStockOut
                  ? "group-hover/blockHeader:ring-amber-300/70 group-hover/blockHeader:text-amber-700"
                  : "group-hover/blockHeader:ring-indigo-300/70 group-hover/blockHeader:text-indigo-600"
            )}
            aria-expanded={!collapsed}
            aria-label={chevronAria}
          >
            <Chevron open={!collapsed} />
          </button>
          <div className="min-w-0 flex-1">
            <ProcurementRequestCardHeader
              title={
                <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    className={cn(
                      panelTypography.rowTitle,
                      procurementSupplierNameLinkClass(unseenVariant)
                    )}
                    onClick={() => onOpenSupplier(block.supplierId)}
                  >
                    {block.supplierName}
                  </button>
                  <Badge
                    variant="default"
                    className={cn(
                      "px-1.5 py-0 text-[10px] font-medium ring-1 ring-inset",
                      isStockOut
                        ? "bg-amber-100/90 text-amber-900 ring-amber-200/80"
                        : "bg-indigo-100/80 text-indigo-900 ring-indigo-200/70"
                    )}
                  >
                    {groupCountBadge}
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
                  <span
                    className={cn(
                      "hidden text-[10px] font-medium sm:inline",
                      "opacity-0 transition-opacity duration-150",
                      "group-hover/blockHeader:opacity-100",
                      isStockOut ? "text-amber-700/80" : "text-indigo-600/80"
                    )}
                    aria-hidden
                  >
                    {headerActionLabel}
                  </span>
                </div>
              }
              trailing={
                plannedOrderDate ? (
                  <PlannedOrderDateMeta
                    display={plannedOrderDate}
                    density="panel"
                    className="shrink-0"
                  />
                ) : null
              }
            />
            {collapsed ? (
              <ProcurementRequestContextBlock
                chips={
                  vacationWindow || hasCollapsedFlags ? (
                    <>
                      {vacationWindow ? (
                        <SupplierVacationNowChip window={vacationWindow} />
                      ) : null}
                      {hasCollapsedFlags ? (
                        <ProcurementRequestFlagGroupChip
                          lines={flagLines}
                          definitions={flagDefinitions}
                          disabled
                          className="max-w-full"
                        />
                      ) : null}
                    </>
                  ) : null
                }
                meta={
                  <>
                    <ProcurementRequestContextMetaItem showSep={false}>
                      {collapsedHint}
                    </ProcurementRequestContextMetaItem>
                    {leadTimeBrief ? (
                      <ProcurementRequestContextMetaItem showSep>
                        {leadTimeBrief}
                      </ProcurementRequestContextMetaItem>
                    ) : null}
                  </>
                }
              />
            ) : (
              <ProcurementRequestContextBlock
                chips={
                  vacationWindow ? (
                    <SupplierVacationNowChip window={vacationWindow} />
                  ) : null
                }
                meta={
                  <>
                    <ProcurementRequestContextMetaItem showSep={false}>
                      {locationSummary}
                    </ProcurementRequestContextMetaItem>
                    {leadTimeBrief ? (
                      <ProcurementRequestContextMetaItem showSep>
                        {leadTimeBrief}
                      </ProcurementRequestContextMetaItem>
                    ) : null}
                  </>
                }
              />
            )}
          </div>
        </div>
      </div>
      <ProcurementRequestActionsFooter
        forceVisible={pending}
        className={procurementSupplierBlockFooterClass}
      >
        <div className="flex w-full min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
          <span className={procurementRequestFooterScopeLabelClass}>
            Zamów razem · {productCount}
          </span>
          <div className="min-w-0 flex-1">
            <ProcurementSupplierBlockActionBar
              block={block}
              pending={pending}
              run={run}
              itemKind={groupKind}
              tone={unseenVariant}
            />
          </div>
        </div>
      </ProcurementRequestActionsFooter>
    </div>
  );
}
