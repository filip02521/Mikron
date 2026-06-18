"use client";

import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import type {
  SummaryForSomeoneEnriched,
  SupplierSummaryMeta,
  WeekDayPlan,
} from "@/lib/orders/summary-workspace";
import { PlannedOrderDateMeta } from "@/components/orders/PlannedOrderDateMeta";
import { parseDateOnly } from "@/lib/orders/dates";
import { enrichForSomeoneGroup, enrichStockOutSignalGroup, plannedOrderDateForSupplier } from "@/lib/orders/procurement-daily-ui";
import { todayInWarsaw } from "@/lib/time/warsaw";
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
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ProcurementCancelDialog } from "@/components/procurement/ProcurementCancelDialog";
import type { DailyPanelRunFn } from "@/components/summary/useDailyPanelRunner";
import type { DeliveryStats, StatsMode } from "@/types/database";
import { formatSupplierLeadTimeBrief } from "@/lib/orders/delivery-eta";
import {
  ProcurementRequestLine,
  ProcurementRequestLineInline,
  ProcurementRequestClientMeta,
  procurementGroupRequestNote,
} from "@/components/summary/ProcurementRequestLine";
import { ProcurementSalesRequestNote } from "@/components/orders/ProcurementSalesRequestNote";
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
import { panelRowClearFocusOnLeave } from "@/lib/ui/panel-row-actions-reveal";
import {
  procurementNestedRowMeta,
  procurementRequestRowClassName,
} from "@/components/summary/procurement-request-row-styles";
import { shouldSuppressProcurementLineClient, shouldSuppressProcurementLineRequestNote, shouldSuppressProcurementGroupPlannedOrderDate } from "@/components/summary/procurement-request-client-ui";
import {
  dailyPanelUnseenBadgeClass,
  panelNameLinkClass,
  panelTypography,
  procurementSupplierBlockInnerListClass,
  procurementSupplierBlockShellClass,
  type DailyPanelUnseenVariant,
} from "@/lib/ui/ontime-theme";
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
import {
  dailyPanelListBodyClass,
} from "@/components/summary/daily-panel-list-styles";
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

  useEffect(() => {
    locallySeenRef.current = locallySeenKeys;
  }, [locallySeenKeys]);

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
  supplierMeta = {},
  todayDateKey,
  weekDays = [],
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
  supplierMeta?: Record<string, SupplierSummaryMeta>;
  todayDateKey?: string;
  weekDays?: WeekDayPlan[];
  queueStep?: number;
  sectionId?: string;
  variant?: "requests" | "stockOut";
  highlightFresh?: boolean;
}) {
  const isStockOutSection = variant === "stockOut";
  const showViaPanelSectionCallout =
    !isStockOutSection && groups.some(groupHasInformacjaFlow);
  const enrichAt = useMemo(
    () =>
      todayDateKey
        ? (parseDateOnly(todayDateKey) ?? todayInWarsaw())
        : todayInWarsaw(),
    [todayDateKey]
  );
  const enrichGroup = useCallback(
    (group: SummaryForSomeoneEnriched) =>
      isStockOutSection
        ? enrichStockOutSignalGroup(group)
        : enrichForSomeoneGroup(group, enrichAt, {
            supplierMeta: supplierMeta[group.supplierId] ?? null,
            todayDateKey,
            weekDays,
          }),
    [enrichAt, isStockOutSection, supplierMeta, todayDateKey, weekDays]
  );
  const unseenVariant: DailyPanelUnseenVariant = isStockOutSection ? "stockOut" : "prosby";
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
        <Badge className={cn("h-7 shrink-0 px-2 text-[11px] font-semibold", dailyPanelUnseenBadgeClass(unseenVariant))}>
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

  const resolvedFocusedGroupKey = useMemo(() => {
    if (!focusedGroupKey) return null;
    return navigableGroups.some((g) => groupKey(g) === focusedGroupKey)
      ? focusedGroupKey
      : null;
  }, [focusedGroupKey, navigableGroups]);

  const focusedGroup = useMemo(() => {
    if (!resolvedFocusedGroupKey) return null;
    return navigableGroups.find((g) => groupKey(g) === resolvedFocusedGroupKey) ?? null;
  }, [resolvedFocusedGroupKey, navigableGroups]);

  useEffect(() => {
    if (!focusedGroup) return;
    scheduleMarkSeen(focusedGroup);
  }, [focusedGroup, scheduleMarkSeen]);

  useEffect(() => {
    if (!resolvedFocusedGroupKey) return;
    document
      .querySelector<HTMLElement>(
        `[data-procurement-group="${CSS.escape(resolvedFocusedGroupKey)}"]`
      )
      ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [resolvedFocusedGroupKey]);

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

      const currentIndex = resolvedFocusedGroupKey
        ? navigableGroups.findIndex((g) => groupKey(g) === resolvedFocusedGroupKey)
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
  }, [navigableGroups, focusedGroup, resolvedFocusedGroupKey, editTarget, cancelTarget, run, markGroupSeen, enrichGroup]);

  const Wrapper = "section";
  const wrapperProps = {
    id: sectionId,
    className: cn(
      dailyPanelQueueSectionScrollClass,
      dailyPanelQueueShellClass(isStockOutSection ? "stockOut" : "prosby")
    ),
  };

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
      <ProcurementCancelDialog
        open={cancelTarget !== null}
        title="Anulować prośbę?"
        headline={cancelTarget?.headline}
        message="Cofnięcie przywraca status w systemie. E-mail do handlowca mógł już zostać wysłany."
        confirmLabel="Anuluj prośbę"
        tier={editTarget ? "stack" : "raised"}
        pending={cancelTarget ? isScopePending(cancelTarget.scopeKey) : false}
        onCancel={() => setCancelTarget(null)}
        onConfirm={(note) => {
          if (!cancelTarget) return;
          const { orderIds, scopeKey } = cancelTarget;
          run(
            () => actionProcessIndividual(orderIds, "ANULOWANO", note),
            "Anulowano prośbę",
            "Anulowanie prośby…",
            { scope: scopeKey, onSuccess: () => setCancelTarget(null) }
          );
        }}
      />
      {subsectionHeader}

      {!showViaPanelSectionCallout ? null : (
        <InformacjaViaPanelProcurementCallout className="mx-0" />
      )}

      <ul className={dailyPanelListBodyClass}>
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
          const blockPlannedOrderDate =
            showSupplierHeader && !isStockOutSection
              ? plannedOrderDateForSupplier(supplierMeta[block.supplierId] ?? null, {
                  todayDateKey,
                  weekDays,
                  supplierId: block.supplierId,
                })
              : null;

          return (
            <li
              key={block.supplierId}
              className={cn(
                showSupplierHeader && procurementSupplierBlockShellClass(unseenVariant)
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
                  unseenVariant={unseenVariant}
                  plannedOrderDate={blockPlannedOrderDate}
                  onToggleCollapse={() => toggleSupplierCollapse(block.supplierId)}
                  onOpenSupplier={onOpenSupplier}
                />
              ) : null}
              {!supplierCollapsed ? (
                <ul
                  className={cn(
                    showSupplierHeader &&
                      procurementSupplierBlockInnerListClass(unseenVariant)
                  )}
                >
                  {block.requestGroups.map((g) => {
                    const key = groupKey(g);
                    const groupPending = isScopePending(key) || blockPending;
                    const isFocused = resolvedFocusedGroupKey === key;
                    const ui = enrichGroup(g);
                    const isUnseen = isGroupUnseen(g);
                    const stats = statsBySupplierId[g.supplierId];
                    const statsMode = supplierStatsMode[g.supplierId] ?? "LACZNIE";
                    const leadTimeBrief = stats
                      ? formatSupplierLeadTimeBrief(stats, statsMode)
                      : null;
                    const hasInfoViaPanel =
                      !isStockOutSection && g.lines.some((l) => l.informacjaViaPanel);
                    const statusBadgeVariant = isStockOutSection
                      ? "warning"
                      : hasInfoViaPanel
                        ? "info"
                        : "default";
                    const singleLine = g.lines.length === 1 ? g.lines[0]! : null;
                    const hasMultiLine = g.lines.length >= 2;
                    const isOpen = hasMultiLine && expanded.has(key);
                    const countLabel = procurementProductCountLabel(g.lines.length);
                    const clientLabel = clientNamesSummaryFromLines(g.lines);
                    const sharedGroupNote = hasMultiLine ? procurementGroupRequestNote(g.lines) : null;
                    const suppressLineRequestNote = shouldSuppressProcurementLineRequestNote(sharedGroupNote);
                    const suppressLineClient = shouldSuppressProcurementLineClient(clientLabel);
                    const suppressGroupPlannedOrderDate =
                      shouldSuppressProcurementGroupPlannedOrderDate(showSupplierHeader);
                    const showSupplierFirst = !showSupplierHeader && !isStockOutSection;
                    const rowSubline = showSupplierHeader
                      ? procurementNestedRowMeta({ countLabel })
                      : ui.subline;
                    const showRowLeadTime = !showSupplierHeader || !blockLeadTimeBrief;
                    const expandDividerClass =
                      unseenVariant === "stockOut"
                        ? "border-amber-100/80"
                        : "border-indigo-100/70";

                    return (
                      <li key={key}>
                        <article
                          data-procurement-group={key}
                          className={procurementRequestRowClassName({
                            variant: unseenVariant,
                            nestedInBlock: showSupplierHeader,
                            isUnseen,
                            isFocused,
                            highlightFresh,
                            pending: groupPending,
                          })}
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
                            if (resolvedFocusedGroupKey === key) setFocusedGroupKey(null);
                          }}
                        >
                          <div className="px-2.5 py-2 sm:px-3">
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
                          <Badge className={cn("px-1.5 py-0 text-[10px] font-semibold", dailyPanelUnseenBadgeClass(unseenVariant))}>
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
                      <ProcurementRequestClientMeta clientLabel={clientLabel} className="mt-1" />
                      <p
                        className="mt-0.5 text-[11px] text-slate-400"
                        title={ui.submittedTitle}
                      >
                        Zgłoszono {ui.submittedLabel}
                        {showRowLeadTime && leadTimeBrief ? ` · ${leadTimeBrief}` : ""}
                      </p>
                      {singleLine ? (
                        <ProcurementRequestLineInline
                          line={singleLine}
                          suppressClient={suppressLineClient}
                        />
                      ) : sharedGroupNote ? (
                        <ProcurementSalesRequestNote
                          note={sharedGroupNote}
                          className="mt-1.5"
                        />
                      ) : null}
                    </div>
                    <div className="flex flex-col items-stretch gap-1.5 sm:shrink-0 sm:items-end">
                      {ui.plannedOrderDate && !suppressGroupPlannedOrderDate ? (
                        <PlannedOrderDateMeta
                          display={ui.plannedOrderDate}
                          className="self-start sm:self-auto"
                        />
                      ) : null}
                      <Badge
                        variant={statusBadgeVariant}
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
                  {hasInfoViaPanel ? (
                    g.supplierOrderOnDemand ? (
                      <div className="mt-1.5 rounded-md border border-slate-200/90 bg-slate-50/90 px-2 py-1 text-[11px] leading-snug text-slate-700">
                        <p>{PROCUREMENT_GLOWNE_ON_DEMAND_HINT}</p>
                      </div>
                    ) : showViaPanelSectionCallout ? null : (
                      <div className="mt-1.5 rounded-md border border-slate-200/90 bg-slate-50/90 px-2 py-1 text-[11px] leading-snug text-slate-700">
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
                      variant="ghost"
                      size="sm"
                      disabled={groupPending}
                      className="mt-1.5 h-7 shrink-0 px-2 text-xs font-semibold text-slate-600"
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
                      {isOpen ? "Zwiń produkty" : `Pokaż produkty (${g.lines.length})`}
                    </Button>
                  ) : null}
                </div>
                {isOpen ? (
                  <div className={cn("border-t", expandDividerClass)}>
                    <ul className="space-y-1 px-2.5 py-1.5 sm:px-3">
                      {g.lines.map((line) => (
                        <ProcurementRequestLine
                          key={line.id}
                          line={line}
                          suppressRequestNote={suppressLineRequestNote}
                          suppressClient={suppressLineClient}
                        />
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
