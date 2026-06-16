"use client";

import { Fragment, useCallback, useEffect, useMemo, useReducer } from "react";
import type { SalesZkWatch } from "@/types/database";
import type { ZkWatchOrderHints } from "@/lib/sales/zk-watch-order-link";
import type { ZkWatchRefreshDiff } from "@/lib/sales/zk-watch-refresh-diff";
import { groupZkWatchesByMonth, type ZkWatchMonthGroup } from "@/lib/sales/zk-watch-sort";
import {
  collapseAllZkMonthGroups,
  defaultCollapsedZkMonthKeys,
  expandAllZkMonthGroups,
  expandMonthGroupKey,
  isZkMonthGroupExpanded,
  mergeZkMonthCollapseOnGroupsChange,
  monthKeyForWatchInGroups,
  toggleZkMonthGroupCollapsed,
  zkWatchMonthGroupsSignature,
} from "@/lib/sales/zk-watch-month-collapse";
import { flashNotepadAnchor } from "@/lib/sales/notepad-anchor";
import { formatProsbaZkLinkNumber } from "@/lib/orders/zk-prosba-link-display";
import { cn } from "@/lib/cn";
import { panelTextLinkClass, salesTypography } from "@/lib/ui/ontime-theme";
import { IconChevronRight } from "@/components/icons/StrokeIcons";
import { ZkWatchCard } from "./ZkWatchCard";
import { NOTATNIK_ZK_LIST_CLASS } from "./notatnik-layout";

function ZkWatchMonthExpandControl({
  groupCount,
  allExpanded,
  onExpandAll,
  onCollapseAll,
}: {
  groupCount: number;
  allExpanded: boolean;
  onExpandAll: () => void;
  onCollapseAll: () => void;
}) {
  if (groupCount <= 1) return null;

  return (
    <div className="flex justify-end border-b border-slate-100 px-3 py-1.5">
      <button
        type="button"
        onClick={() => (allExpanded ? onCollapseAll() : onExpandAll())}
        className={cn(panelTextLinkClass, "text-[11px] transition hover:underline")}
      >
        {allExpanded ? "Zwiń wszystkie miesiące" : "Rozwiń wszystkie miesiące"}
      </button>
    </div>
  );
}

type ListUiState = {
  collapsedMonths: Set<string>;
  groupsSignature: string;
  openModalWatchId: string | null;
  appliedFocusWatchId: string | null;
};

type ListUiAction =
  | { type: "toggleMonth"; monthKey: string }
  | { type: "expandAll"; groups: ZkWatchMonthGroup[] }
  | { type: "collapseAll"; groups: ZkWatchMonthGroup[] }
  | { type: "syncGroups"; groups: ZkWatchMonthGroup[]; signature: string }
  | { type: "syncFocus"; focusWatchId: string; groups: ZkWatchMonthGroup[] }
  | { type: "setModal"; watchId: string | null }
  | { type: "closeMissingModal"; watchIds: Set<string> };

function listUiReducer(state: ListUiState, action: ListUiAction): ListUiState {
  switch (action.type) {
    case "toggleMonth":
      return {
        ...state,
        collapsedMonths: toggleZkMonthGroupCollapsed(state.collapsedMonths, action.monthKey),
      };
    case "expandAll":
      return { ...state, collapsedMonths: expandAllZkMonthGroups(action.groups) };
    case "collapseAll":
      return { ...state, collapsedMonths: collapseAllZkMonthGroups(action.groups) };
    case "syncGroups":
      if (state.groupsSignature === action.signature) return state;
      return {
        ...state,
        groupsSignature: action.signature,
        collapsedMonths: mergeZkMonthCollapseOnGroupsChange(state.collapsedMonths, action.groups),
      };
    case "syncFocus": {
      if (state.appliedFocusWatchId === action.focusWatchId) return state;
      const monthKey = monthKeyForWatchInGroups(action.groups, action.focusWatchId);
      if (!monthKey) return state;
      return {
        ...state,
        appliedFocusWatchId: action.focusWatchId,
        collapsedMonths: expandMonthGroupKey(state.collapsedMonths, monthKey),
      };
    }
    case "setModal":
      return { ...state, openModalWatchId: action.watchId };
    case "closeMissingModal":
      if (!state.openModalWatchId || action.watchIds.has(state.openModalWatchId)) return state;
      return { ...state, openModalWatchId: null };
    default:
      return state;
  }
}

export function ZkWatchGroupedList({
  watches,
  zkHintsByWatchId,
  readOnly,
  tourPreview,
  compact,
  archived,
  subiektReachable,
  onClosed,
  onRestored,
  onRefreshed,
  onDeleted,
  unseenWatchIds,
  newLineKeysByWatchId,
  onWarehouseArrivalSeen,
  onNewZkLinesSeen,
  onWatchDetailOpen,
  prosbaScopeWatchId,
  onProsbaScopeConfigured,
  focusWatchId,
  onFocusWatchHandled,
  onLiveAnnounce,
}: {
  watches: SalesZkWatch[];
  zkHintsByWatchId?: Map<string, ZkWatchOrderHints>;
  unseenWatchIds?: Set<string>;
  newLineKeysByWatchId?: Record<string, string[]>;
  onWarehouseArrivalSeen?: (watchId: string) => void;
  onNewZkLinesSeen?: (watchId: string) => void;
  onWatchDetailOpen?: (watchId: string) => void;
  prosbaScopeWatchId?: string | null;
  onProsbaScopeConfigured?: (watchId: string) => void;
  /** Po wejściu z linku (#watch-…) — rozwiń miesiąc i podświetl kartę. */
  focusWatchId?: string | null;
  onFocusWatchHandled?: (watchId: string) => void;
  onLiveAnnounce?: (message: string) => void;
  readOnly?: boolean;
  tourPreview?: boolean;
  compact?: boolean;
  archived?: boolean;
  subiektReachable?: boolean;
  onClosed?: (watchId: string, closedAt: string) => void;
  onRestored?: (watch: SalesZkWatch) => void;
  onRefreshed?: (watch: SalesZkWatch, refreshDiff?: ZkWatchRefreshDiff) => void;
  onDeleted?: (watchId: string) => void;
}) {
  const groups = useMemo(() => groupZkWatchesByMonth(watches), [watches]);
  const groupsSignature = useMemo(() => zkWatchMonthGroupsSignature(groups), [groups]);
  const watchIds = useMemo(() => new Set(watches.map((watch) => watch.id)), [watches]);

  const [uiState, dispatchUi] = useReducer(listUiReducer, groups, (initialGroups) => ({
    collapsedMonths: defaultCollapsedZkMonthKeys(initialGroups),
    groupsSignature: zkWatchMonthGroupsSignature(initialGroups),
    openModalWatchId: null,
    appliedFocusWatchId: null,
  }));

  if (uiState.groupsSignature !== groupsSignature) {
    dispatchUi({ type: "syncGroups", groups, signature: groupsSignature });
  }

  if (focusWatchId && focusWatchId !== uiState.appliedFocusWatchId) {
    dispatchUi({ type: "syncFocus", focusWatchId, groups });
  }

  if (uiState.openModalWatchId && !watchIds.has(uiState.openModalWatchId)) {
    dispatchUi({ type: "closeMissingModal", watchIds });
  }

  const { collapsedMonths, openModalWatchId } = uiState;

  useEffect(() => {
    if (!focusWatchId) return;
    if (!watches.some((watch) => watch.id === focusWatchId)) return;

    const monthKey = monthKeyForWatchInGroups(groups, focusWatchId);
    if (monthKey && !isZkMonthGroupExpanded(monthKey, collapsedMonths)) return;

    const focusedWatch = watches.find((watch) => watch.id === focusWatchId);
    const announce = focusedWatch
      ? `Przewinięto do ZK ${formatProsbaZkLinkNumber(focusedWatch.zk_number)}`
      : undefined;

    flashNotepadAnchor(`watch-${focusWatchId}`, {
      delayMs: 180,
      durationMs: 2400,
      announce,
      onAnnounce: onLiveAnnounce,
      onFound: () => onFocusWatchHandled?.(focusWatchId),
    });
  }, [focusWatchId, watches, groups, collapsedMonths, onFocusWatchHandled, onLiveAnnounce]);

  const toggleMonth = useCallback((monthKey: string) => {
    dispatchUi({ type: "toggleMonth", monthKey });
  }, []);

  const expandAll = useCallback(() => {
    dispatchUi({ type: "expandAll", groups });
  }, [groups]);

  const collapseAll = useCallback(() => {
    dispatchUi({ type: "collapseAll", groups });
  }, [groups]);

  const allExpanded =
    groups.length > 0 && groups.every((g) => isZkMonthGroupExpanded(g.key, collapsedMonths));

  return (
    <div>
      <ZkWatchMonthExpandControl
        groupCount={groups.length}
        allExpanded={allExpanded}
        onExpandAll={expandAll}
        onCollapseAll={collapseAll}
      />
      <ul className={NOTATNIK_ZK_LIST_CLASS}>
        {groups.map((group) => {
          const isOpen = isZkMonthGroupExpanded(group.key, collapsedMonths);

          return (
            <Fragment key={group.key}>
              <li className="list-none">
                <button
                  type="button"
                  onClick={() => toggleMonth(group.key)}
                  aria-expanded={isOpen}
                  aria-label={`${group.label}, ${group.watches.length} ZK, ${isOpen ? "rozwinięte" : "zwinięte"}`}
                  className="flex w-full items-center gap-2 border-y border-slate-200/90 bg-slate-50/95 px-3 py-1.5 text-left backdrop-blur-sm transition hover:bg-slate-100/90"
                >
                  <IconChevronRight
                    size={14}
                    className={cn(
                      "shrink-0 text-slate-500 transition-transform",
                      isOpen && "rotate-90"
                    )}
                  />
                  <span className={salesTypography.sectionLabel}>
                    {group.label}
                    <span className="ml-2 font-normal normal-case tabular-nums text-slate-400">
                      ({group.watches.length})
                    </span>
                  </span>
                </button>
              </li>
              {group.watches.map((watch) => {
                const monthExpanded = isOpen;
                const modalPinned = openModalWatchId === watch.id;
                if (!monthExpanded && !modalPinned) return null;

                return (
                  <li key={watch.id}>
                    <ZkWatchCard
                      watch={watch}
                      anchorId={`watch-${watch.id}`}
                      orderHints={zkHintsByWatchId?.get(watch.id)}
                      readOnly={readOnly}
                      tourPreview={tourPreview}
                      compact={compact}
                      archived={archived}
                      subiektReachable={subiektReachable}
                      onClosed={(closedAt) => onClosed?.(watch.id, closedAt)}
                      onRestored={onRestored}
                      onRefreshed={onRefreshed}
                      onDeleted={() => onDeleted?.(watch.id)}
                      onLinesModalOpenChange={(open) => {
                        dispatchUi({ type: "setModal", watchId: open ? watch.id : null });
                      }}
                      hasNewWarehouseArrival={unseenWatchIds?.has(watch.id) ?? false}
                      hasNewZkLines={(newLineKeysByWatchId?.[watch.id]?.length ?? 0) > 0}
                      newLineKeys={newLineKeysByWatchId?.[watch.id]}
                      onWarehouseArrivalSeen={onWarehouseArrivalSeen}
                      onNewZkLinesSeen={onNewZkLinesSeen}
                      onWatchDetailOpen={onWatchDetailOpen}
                      prosbaScopeRequired={prosbaScopeWatchId === watch.id}
                      onProsbaScopeConfigured={onProsbaScopeConfigured}
                    />
                  </li>
                );
              })}
            </Fragment>
          );
        })}
      </ul>
    </div>
  );
}
