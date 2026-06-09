"use client";

import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import type { SummaryForSomeoneEnriched } from "@/lib/orders/summary-workspace";
import { enrichForSomeoneGroup, enrichStockOutSignalGroup } from "@/lib/orders/procurement-daily-ui";
import { useProcurementSupplierCollapse } from "@/components/summary/useProcurementSupplierCollapse";
import {
  buildProcurementSupplierBlocks,
  filterNavigableProcurementGroups,
  procurementProductCountLabel,
  showProcurementSupplierBlockHeader,
  procurementSupplierBlockScopeKey,
} from "@/lib/orders/procurement-supplier-groups";
import { ProcurementSupplierBlockBar } from "@/components/summary/ProcurementSupplierBlockBar";
import { locationLabel } from "@/lib/display-labels";
import { actionMarkProcurementRequestsSeen, actionProcessIndividual } from "@/app/actions/admin";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import type { DailyPanelRunFn } from "@/components/summary/useDailyPanelRunner";
import type { DeliveryStats, StatsMode } from "@/types/database";
import { formatSupplierLeadTimeBrief } from "@/lib/orders/delivery-eta";
import { ProcurementRequestLine, ProcurementRequestLineInline } from "@/components/summary/ProcurementRequestLine";
import {
  EditIndividualRequestModal,
  type EditIndividualRequestInitial,
} from "@/components/orders/EditIndividualRequestModal";
import { editInitialFromForSomeoneGroup } from "@/lib/orders/individual-request-edit-ui";
import { IndividualRequestActionBar } from "@/components/summary/IndividualRequestActionBar";
import {
  DailyPanelSubsectionBar,
  dailyPanelQueueShellClass,
} from "@/components/summary/DailyPanelSubsectionBar";
import { cn } from "@/lib/cn";
import { PanelRowActionsInlineEnd } from "@/components/summary/PanelRowActionsInlineEnd";
import { panelRowClearFocusOnLeave, panelRowGroupClass } from "@/lib/ui/panel-row-actions-reveal";
import { panelNameLinkClass, panelTypography, rowPendingRingClass, dailyPanelFreshHighlightClass } from "@/lib/ui/ontime-theme";
import { dailyPanelQueueSectionScrollClass } from "@/lib/orders/daily-panel-section-anchors";
import {
  panelQueueRowActionsClass,
  panelQueueRowLayoutClass,
} from "@/lib/ui/surfaces";
import {
  INFORMACJA_FLOW_PROCUREMENT_GROUP_BANNER,
  INFORMACJA_STOCK_OUT_PROCUREMENT_SECTION_HINT,
} from "@/lib/orders/informacja-flow-copy";
import {
  ForSomeoneRequestsSectionHelp,
  StockOutSectionHelp,
} from "@/components/summary/ForSomeoneRequestsHelp";
import { InformacjaViaPanelProcurementCallout } from "@/components/orders/InformacjaFlowLegend";
import { clientNamesSummaryFromLines } from "@/lib/orders/sales-client-label";
import { PROCUREMENT_GLOWNE_ON_DEMAND_HINT } from "@/lib/orders/glowne-action-ui";
import type { OrderFormSupplierOption } from "@/lib/orders/order-form-suppliers";

function groupHasInformacjaFlow(g: SummaryForSomeoneEnriched): boolean {
  return g.lines.some((l) => l.informacjaViaPanel);
}

function groupKey(g: SummaryForSomeoneEnriched) {
  return `${g.supplierId}-${g.salesPersonId}`;
}

const MARK_SEEN_DELAY_MS = 1500;

function useProcurementSeenTracker() {
  const [locallySeenKeys, setLocallySeenKeys] = useState<Set<string>>(() => new Set());
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  /** Klucze, dla których wysłano już zapis do API (poza cyklem renderu). */
  const persistSeenRef = useRef<Set<string>>(new Set());
  const locallySeenRef = useRef(locallySeenKeys);
  locallySeenRef.current = locallySeenKeys;

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
    };
  }, []);

  const isGroupUnseen = useCallback(
    (group: SummaryForSomeoneEnriched) =>
      group.hasUnseen && !locallySeenKeys.has(groupKey(group)),
    [locallySeenKeys]
  );

  const markGroupSeen = useCallback((group: SummaryForSomeoneEnriched) => {
    if (!group.hasUnseen) return;
    const key = groupKey(group);
    if (locallySeenRef.current.has(key) || persistSeenRef.current.has(key)) return;

    persistSeenRef.current.add(key);
    setLocallySeenKeys((prev) => new Set(prev).add(key));

    void actionMarkProcurementRequestsSeen(group.orderIds).catch(() => {
      persistSeenRef.current.delete(key);
      setLocallySeenKeys((prev) => {
        if (!prev.has(key)) return prev;
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    });
  }, []);

  const scheduleMarkSeen = useCallback(
    (group: SummaryForSomeoneEnriched) => {
      const key = groupKey(group);
      if (!group.hasUnseen || locallySeenRef.current.has(key)) return;
      const existing = timersRef.current.get(key);
      if (existing) clearTimeout(existing);
      timersRef.current.set(
        key,
        setTimeout(() => {
          timersRef.current.delete(key);
          markGroupSeen(group);
        }, MARK_SEEN_DELAY_MS)
      );
    },
    [markGroupSeen]
  );

  const cancelMarkSeen = useCallback((group: SummaryForSomeoneEnriched) => {
    const key = groupKey(group);
    const existing = timersRef.current.get(key);
    if (existing) {
      clearTimeout(existing);
      timersRef.current.delete(key);
    }
  }, []);

  return { isGroupUnseen, markGroupSeen, scheduleMarkSeen, cancelMarkSeen };
}

export function ForSomeoneRequests({
  groups,
  isScopePending,
  run,
  onOpenSupplier,
  statsBySupplierId = {},
  supplierStatsMode = {},
  suppliers = [],
  salesPeople = [],
  embedded = false,
  queueStep,
  sectionId = "kolejka-prosby",
  variant = "requests",
  highlightFresh = false,
}: {
  groups: SummaryForSomeoneEnriched[];
  isScopePending: (scope: string) => boolean;
  run: DailyPanelRunFn;
  onOpenSupplier: (id: string) => void;
  statsBySupplierId?: Record<string, DeliveryStats>;
  supplierStatsMode?: Record<string, StatsMode>;
  suppliers?: OrderFormSupplierOption[];
  salesPeople?: { id: string; name: string }[];
  embedded?: boolean;
  queueStep?: number;
  sectionId?: string;
  variant?: "requests" | "stockOut";
  highlightFresh?: boolean;
}) {
  const isStockOutSection = variant === "stockOut";
  const showViaPanelSectionCallout =
    !isStockOutSection && groups.some(groupHasInformacjaFlow);
  const enrichGroup = isStockOutSection ? enrichStockOutSignalGroup : enrichForSomeoneGroup;
  const unseenBadgeVariant = isStockOutSection ? "warning" : "purple";
  const supplierBlocks = useMemo(
    () => buildProcurementSupplierBlocks(groups),
    [groups]
  );
  const { isGroupUnseen, markGroupSeen, scheduleMarkSeen, cancelMarkSeen } =
    useProcurementSeenTracker();
  const forceExpandedSupplierIds = useMemo(() => {
    const ids = new Set<string>();
    for (const block of supplierBlocks) {
      if (block.requestGroups.some((g) => isGroupUnseen(g))) {
        ids.add(block.supplierId);
      }
    }
    return ids;
  }, [supplierBlocks, isGroupUnseen]);
  const {
    collapsibleBlocks,
    collapsedSuppliers,
    allSupplierBlocksExpanded,
    toggleSupplierCollapse,
    setAllSupplierBlocksExpanded,
  } = useProcurementSupplierCollapse(supplierBlocks, forceExpandedSupplierIds);

  const navigableGroups = useMemo(
    () => filterNavigableProcurementGroups(supplierBlocks, collapsedSuppliers),
    [supplierBlocks, collapsedSuppliers]
  );
  const unseenGroupCount = useMemo(
    () => groups.filter((g) => isGroupUnseen(g)).length,
    [groups, isGroupUnseen]
  );
  const multiLineKeys = useMemo(
    () => groups.filter((g) => g.lines.length >= 2).map(groupKey),
    [groups]
  );

  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  const allExpanded =
    multiLineKeys.length > 0 && multiLineKeys.every((k) => expanded.has(k));

  const setAll = useCallback(
    (open: boolean) => {
      setExpanded(open ? new Set(multiLineKeys) : new Set());
    },
    [multiLineKeys]
  );

  const queueToolbarActions = (
    <div className="flex flex-wrap items-center justify-end gap-1">
      {unseenGroupCount > 0 ? (
        <Badge variant={unseenBadgeVariant} className="h-7 shrink-0 px-2 text-[11px]">
          {unseenGroupCount}{" "}
          {unseenGroupCount === 1
            ? "nowy"
            : unseenGroupCount >= 2 && unseenGroupCount <= 4
              ? "nowe"
              : "nowych"}
        </Badge>
      ) : null}
      {collapsibleBlocks.length > 0 && !isStockOutSection ? (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-xs"
          onClick={() => setAllSupplierBlocksExpanded(!allSupplierBlocksExpanded)}
        >
          {allSupplierBlocksExpanded ? "Zwiń dostawców" : "Rozwiń dostawców"}
        </Button>
      ) : null}
      {multiLineKeys.length > 1 ? (
        <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => setAll(!allExpanded)}>
          {allExpanded ? "Zwiń produkty" : "Rozwiń produkty"}
        </Button>
      ) : null}
      {isStockOutSection ? <StockOutSectionHelp /> : <ForSomeoneRequestsSectionHelp />}
    </div>
  );

  const lineCount = groups.reduce((n, g) => n + g.lines.length, 0);
  const [cancelTarget, setCancelTarget] = useState<{
    orderIds: string[];
    headline: string;
    scopeKey: string;
  } | null>(null);
  const [editTarget, setEditTarget] = useState<{
    orderIds: string[];
    initial: EditIndividualRequestInitial;
    scopeKey: string;
  } | null>(null);
  const [focusedGroupKey, setFocusedGroupKey] = useState<string | null>(null);

  const focusedGroup = useMemo(() => {
    if (!focusedGroupKey) return null;
    return navigableGroups.find((g) => groupKey(g) === focusedGroupKey) ?? null;
  }, [focusedGroupKey, navigableGroups]);

  useEffect(() => {
    if (focusedGroupKey && !focusedGroup) setFocusedGroupKey(null);
  }, [focusedGroupKey, focusedGroup]);

  useEffect(() => {
    if (!focusedGroup) return;
    scheduleMarkSeen(focusedGroup);
  }, [focusedGroup, scheduleMarkSeen]);

  useEffect(() => {
    if (!focusedGroupKey) return;
    document
      .querySelector<HTMLElement>(
        `[data-procurement-group="${CSS.escape(focusedGroupKey)}"]`
      )
      ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [focusedGroupKey]);

  useEffect(() => {
    if (editTarget || cancelTarget || !navigableGroups.length) return;

    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
        if (e.key === "Escape") (e.target as HTMLElement).blur();
        return;
      }

      if (e.key === "Escape") {
        setFocusedGroupKey(null);
        return;
      }

      const currentIndex = focusedGroupKey
        ? navigableGroups.findIndex((g) => groupKey(g) === focusedGroupKey)
        : -1;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        const next = Math.min(
          navigableGroups.length - 1,
          currentIndex < 0 ? 0 : currentIndex + 1
        );
        const g = navigableGroups[next];
        setFocusedGroupKey(g ? groupKey(g) : null);
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        const next = Math.max(0, currentIndex < 0 ? 0 : currentIndex - 1);
        const g = navigableGroups[next];
        setFocusedGroupKey(g ? groupKey(g) : null);
        return;
      }

      if (!focusedGroup) return;
      const group = focusedGroup;
      const key = groupKey(group);
      const ui = enrichGroup(group);

      if (e.key === "Enter") {
        if (group.lines.length < 2) return;
        e.preventDefault();
        setExpanded((prev) => {
          const next = new Set(prev);
          if (next.has(key)) next.delete(key);
          else next.add(key);
          return next;
        });
        return;
      }

      if (e.key === "e" || e.key === "E") {
        e.preventDefault();
        markGroupSeen(group);
        setEditTarget({
          orderIds: group.orderIds,
          initial: editInitialFromForSomeoneGroup(group),
          scopeKey: key,
        });
        return;
      }

      if ((e.key === "g" || e.key === "G") && e.shiftKey) {
        e.preventDefault();
        const glowneConfirm = group.supplierOrderOnDemand
          ? `Oznaczyć prośbę u ${group.supplierName} (${group.person}) jako główne bez terminu planowego?`
          : `Oznaczyć „${ui.headline}” jako zamówienie główne?`;
        if (!window.confirm(glowneConfirm)) {
          return;
        }
        run(
          () => actionProcessIndividual(group.orderIds, "GLOWNE"),
          group.supplierOrderOnDemand
            ? "Oznaczono jako główne (bez terminu planowego)"
            : "Oznaczono jako zamówienie główne",
          "Oznaczanie jako główne…",
          { scope: key }
        );
        return;
      }

      if ((e.key === "u" || e.key === "U") && e.shiftKey) {
        e.preventDefault();
        if (
          !window.confirm(
            `Oznaczyć „${ui.headline}” jako uzupełniające?`
          )
        ) {
          return;
        }
        run(
          () => actionProcessIndividual(group.orderIds, "POBOCZNE"),
          "Oznaczono jako uzupełniające",
          "Oznaczanie jako uzupełniające…",
          { scope: key }
        );
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigableGroups, focusedGroup, focusedGroupKey, editTarget, cancelTarget, run, markGroupSeen]);

  const Wrapper = embedded ? "section" : Card;
  const wrapperProps = embedded
    ? {
        id: sectionId,
        className: cn(
          dailyPanelQueueSectionScrollClass,
          dailyPanelQueueShellClass(isStockOutSection ? "stockOut" : "prosby")
        ),
      }
    : { padding: false as const };

  const subsectionHeader = (
    <DailyPanelSubsectionBar
      title={isStockOutSection ? "Brak na stanie — do zamówienia" : "Prośby handlowców"}
      description={
        isStockOutSection ? INFORMACJA_STOCK_OUT_PROCUREMENT_SECTION_HINT : undefined
      }
      tone={isStockOutSection ? "stockOut" : "prosby"}
      step={queueStep}
      count={groups.length}
      countUnit={
        isStockOutSection
          ? { one: "sygnał", few: "sygnały", many: "sygnałów" }
          : { one: "grupa", few: "grupy", many: "grup" }
      }
      compact={!isStockOutSection}
      action={queueToolbarActions}
    />
  );

  const legacyHeader = (
    <CardHeader
      inset
      title="Prośby handlowców"
      description={`Prośby w kolejce dnia · ${groups.length} ${groups.length === 1 ? "grupa" : "grup"} · ${lineCount} ${lineCount === 1 ? "produkt" : "produktów"}`}
      action={queueToolbarActions}
    />
  );

  return (
    <Wrapper {...wrapperProps}>
      <EditIndividualRequestModal
        open={editTarget !== null}
        mode="procurement"
        orderIds={editTarget?.orderIds ?? []}
        initial={editTarget?.initial ?? null}
        suppliers={suppliers}
        salesPeople={salesPeople}
        onClose={() => setEditTarget(null)}
        onSaved={(msg) =>
          run(
            async () => ({ success: true as const }),
            msg,
            "Odświeżanie panelu…",
            editTarget
              ? { scope: `${editTarget.scopeKey}:edit`, overlay: false }
              : { overlay: false }
          )
        }
      />
      <ConfirmDialog
        open={cancelTarget !== null}
        title="Anulować prośbę?"
        message={
          cancelTarget
            ? `Czy na pewno anulować: ${cancelTarget.headline}? Możesz cofnąć w ciągu 10 sekund po potwierdzeniu.`
            : ""
        }
        confirmLabel="Anuluj prośbę"
        danger
        pending={cancelTarget ? isScopePending(cancelTarget.scopeKey) : false}
        onCancel={() => setCancelTarget(null)}
        onConfirm={() => {
          if (!cancelTarget) return;
          const { orderIds, scopeKey } = cancelTarget;
          setCancelTarget(null);
          run(
            () => actionProcessIndividual(orderIds, "ANULOWANO"),
            "Anulowano prośbę",
            "Anulowanie prośby…",
            { scope: scopeKey }
          );
        }}
      />
      {embedded ? subsectionHeader : legacyHeader}

      {!showViaPanelSectionCallout ? null : (
        <InformacjaViaPanelProcurementCallout className="mx-0" />
      )}

      <ul className="space-y-2 p-2 sm:p-2">
        {supplierBlocks.map((block) => {
          const showSupplierHeader = showProcurementSupplierBlockHeader(block);
          const supplierCollapsed =
            showSupplierHeader && collapsedSuppliers.has(block.supplierId);
          const blockStats = statsBySupplierId[block.supplierId];
          const blockStatsMode = supplierStatsMode[block.supplierId] ?? "LACZNIE";
          const blockLeadTimeBrief =
            showSupplierHeader && blockStats
              ? formatSupplierLeadTimeBrief(blockStats, blockStatsMode)
              : null;
          const blockScopeKey = procurementSupplierBlockScopeKey(block.supplierId);
          const blockPending = isScopePending(blockScopeKey);

          return (
            <li
              key={block.supplierId}
              className={cn(
                showSupplierHeader &&
                  "overflow-hidden rounded-md border border-slate-200 bg-white"
              )}
              aria-label={`Dostawca ${block.supplierName}`}
            >
              {showSupplierHeader ? (
                <ProcurementSupplierBlockBar
                  block={block}
                  collapsed={supplierCollapsed}
                  leadTimeBrief={blockLeadTimeBrief}
                  pending={blockPending}
                  run={run}
                  unseenGroupCount={block.requestGroups.filter((g) => isGroupUnseen(g)).length}
                  onToggleCollapse={() => toggleSupplierCollapse(block.supplierId)}
                  onOpenSupplier={onOpenSupplier}
                />
              ) : null}
              {!supplierCollapsed ? (
                <ul
                  className={cn(
                    "space-y-1",
                    showSupplierHeader &&
                      "divide-y divide-slate-100/90 border-t border-slate-100/80 p-1.5 sm:p-2"
                  )}
                >
                  {block.requestGroups.map((g) => {
          const key = groupKey(g);
          const groupPending = isScopePending(key) || blockPending;
          const isFocused = focusedGroupKey === key;
          const ui = enrichGroup(g);
          const isUnseen = isGroupUnseen(g);
          const stats = statsBySupplierId[g.supplierId];
          const statsMode = supplierStatsMode[g.supplierId] ?? "LACZNIE";
          const leadTimeBrief = stats
            ? formatSupplierLeadTimeBrief(stats, statsMode)
            : null;
          const hasInfoViaPanel = !isStockOutSection && g.lines.some((l) => l.informacjaViaPanel);
          const informacjaBadgeVariant = hasInfoViaPanel ? "info" : "default";
          const singleLine = g.lines.length === 1 ? g.lines[0]! : null;
          const hasMultiLine = g.lines.length >= 2;
          const isOpen = hasMultiLine && expanded.has(key);
          const countLabel = procurementProductCountLabel(g.lines.length);
          const clientLabel = clientNamesSummaryFromLines(g.lines);
          const showSupplierFirst = !showSupplierHeader && !isStockOutSection;
          const rowSubline = showSupplierHeader ? countLabel : ui.subline;
          const showRowLeadTime = !showSupplierHeader || !blockLeadTimeBrief;

          return (
            <li key={key}>
              <article
                data-procurement-group={key}
                className={cn(
                  panelRowGroupClass("rounded-md border border-slate-200 bg-white transition-shadow"),
                  groupPending && rowPendingRingClass,
                  isFocused && (isStockOutSection ? "ring-2 ring-amber-400/70 ring-offset-1" : "ring-2 ring-indigo-400/70 ring-offset-1"),
                  isUnseen &&
                    (isStockOutSection
                      ? "border-amber-300/90 bg-amber-50/50"
                      : "border-violet-200/90 bg-violet-50/30"),
                  highlightFresh && isUnseen && dailyPanelFreshHighlightClass
                )}
                aria-busy={groupPending}
                onMouseEnter={() => scheduleMarkSeen(g)}
                onPointerDown={(e) => {
                  if (e.pointerType === "touch") scheduleMarkSeen(g);
                }}
                onClick={(e) => {
                  const target = e.target as HTMLElement;
                  if (target.closest("button, a, [role='button']")) return;
                  scheduleMarkSeen(g);
                }}
                onMouseLeave={(e) => {
                  cancelMarkSeen(g);
                  panelRowClearFocusOnLeave(e);
                  if (focusedGroupKey === key) setFocusedGroupKey(null);
                }}
              >
                <div className="px-2 py-2">
                  <div className={panelQueueRowLayoutClass}>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className={panelTypography.rowTitle}>
                          {showSupplierFirst ? (
                            <button
                              type="button"
                              className={panelNameLinkClass}
                              onClick={() => onOpenSupplier(g.supplierId)}
                            >
                              {g.supplierName}
                            </button>
                          ) : (
                            ui.headline
                          )}
                        </p>
                        {isUnseen ? (
                          <Badge variant={unseenBadgeVariant} className="px-1.5 py-0 text-[10px]">
                            Nowa
                            {ui.unseenCount > 1 ? ` (${ui.unseenCount})` : ""}
                          </Badge>
                        ) : null}
                      </div>
                      <p className={cn("mt-0.5", panelTypography.rowMeta)}>
                        {showSupplierHeader ? (
                          rowSubline
                        ) : showSupplierFirst ? (
                          <>
                            {g.person}
                            {" · "}
                            {countLabel}
                            {clientLabel ? ` · ${clientLabel}` : ""}
                            {" · "}
                            {locationLabel(g.location)}
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              className={panelNameLinkClass}
                              onClick={() => onOpenSupplier(g.supplierId)}
                            >
                              {g.supplierName}
                            </button>
                            {" · "}
                            {ui.subline}
                            {" · "}
                            {locationLabel(g.location)}
                          </>
                        )}
                      </p>
                      <p
                        className="mt-0.5 text-[11px] text-slate-400"
                        title={ui.submittedTitle}
                      >
                        Zgłoszono {ui.submittedLabel}
                      </p>
                      {showRowLeadTime && leadTimeBrief ? (
                        <p className="mt-0.5 text-[10px] text-slate-400">{leadTimeBrief}</p>
                      ) : null}
                      {singleLine ? <ProcurementRequestLineInline line={singleLine} /> : null}
                    </div>
                    <div className="flex flex-col items-stretch gap-1.5 sm:shrink-0 sm:items-end">
                      <Badge
                        variant={informacjaBadgeVariant}
                        className="shrink-0 self-start whitespace-normal text-left text-[10px] leading-snug sm:self-auto sm:text-right"
                      >
                        {ui.statusTitle}
                      </Badge>
                      <PanelRowActionsInlineEnd
                        forceVisible={groupPending}
                        className={panelQueueRowActionsClass}
                        contentClassName="w-full sm:w-max [&>*]:w-full sm:[&>*]:w-auto"
                      >
                        <IndividualRequestActionBar
                          orderIds={g.orderIds}
                          supplierId={g.supplierId}
                          hasInfoViaPanel={hasInfoViaPanel}
                          supplierOrderOnDemand={g.supplierOrderOnDemand}
                          headline={ui.headline}
                          pending={groupPending}
                          scopeKey={key}
                          density={showSupplierHeader ? "nested" : "default"}
                          run={run}
                          onEdit={() => {
                            markGroupSeen(g);
                            setEditTarget({
                              orderIds: g.orderIds,
                              initial: editInitialFromForSomeoneGroup(g),
                              scopeKey: key,
                            });
                          }}
                          onCancel={() =>
                            setCancelTarget({
                              orderIds: g.orderIds,
                              headline: ui.headline,
                              scopeKey: key,
                            })
                          }
                        />
                      </PanelRowActionsInlineEnd>
                    </div>
                  </div>
                  {isStockOutSection && ui.statusDetail ? (
                    <div className="mt-1.5 rounded-md border border-amber-200/90 bg-amber-50/80 px-2 py-1 text-[11px] leading-snug text-amber-950">
                      <p>{ui.statusDetail}</p>
                    </div>
                  ) : hasInfoViaPanel ? (
                    g.supplierOrderOnDemand ? (
                      <div className="mt-1.5 rounded-md border border-slate-200/90 bg-slate-50/90 px-2 py-1 text-[11px] leading-snug text-slate-700">
                        <p>{PROCUREMENT_GLOWNE_ON_DEMAND_HINT}</p>
                      </div>
                    ) : showViaPanelSectionCallout ? null : (
                      <div className="mt-1.5 rounded-md border border-indigo-200/90 bg-indigo-50/60 px-2 py-1 text-[11px] leading-snug text-indigo-950">
                        <p>{INFORMACJA_FLOW_PROCUREMENT_GROUP_BANNER}</p>
                      </div>
                    )
                  ) : g.supplierOrderOnDemand && !isStockOutSection ? (
                    <div className="mt-1.5 rounded-md border border-slate-200/90 bg-slate-50/90 px-2 py-1 text-[11px] leading-snug text-slate-700">
                      <p>
                        Dostawca na żądanie —{" "}
                        <strong className="font-semibold text-slate-900">Główne (bez terminu)</strong>{" "}
                        nie przesuwa harmonogramu w planie tygodnia.
                      </p>
                    </div>
                  ) : null}
                  {hasMultiLine ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={groupPending}
                      className="mt-1.5 h-7 shrink-0 px-2.5"
                      onClick={() => {
                        if (!isOpen) markGroupSeen(g);
                        setExpanded((prev) => {
                          const next = new Set(prev);
                          if (isOpen) next.delete(key);
                          else next.add(key);
                          return next;
                        });
                      }}
                    >
                      {isOpen ? "Zwiń" : `Produkty (${g.lines.length})`}
                    </Button>
                  ) : null}
                </div>
                {isOpen ? (
                  <div className="border-t border-slate-100">
                    <ul className="space-y-1 px-2.5 py-1.5">
                      {g.lines.map((line) => (
                        <ProcurementRequestLine key={line.id} line={line} />
                      ))}
                    </ul>
                  </div>
                ) : null}
              </article>
            </li>
          );
                  })}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
    </Wrapper>
  );
}
