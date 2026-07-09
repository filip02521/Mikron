"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { SalesZkWatch } from "@/types/database";
import type { ZkWatchOrderHints, ZkLinkableOrder } from "@/lib/sales/zk-watch-order-link";
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
import {
  ZkWatchClosePendingHost,
  type ZkWatchClosePendingSession,
} from "./ZkWatchClosePendingHost";
import { NOTATNIK_ZK_LIST_CLASS } from "./notatnik-layout";
import {
  buildZkWatchListVirtualItems,
  zkWatchListScrollKey,
} from "@/lib/sales/zk-watch-list-virtual";
import {
  ZK_MONTH_HEADER_ESTIMATE_PX,
  ZK_WATCH_CARD_ESTIMATE_PX,
  ZK_WATCH_LIST_VIRTUAL_THRESHOLD,
} from "@/lib/ui/virtual-list-config";
import { VirtualList } from "@/components/ui/VirtualList";

const ZkWatchLinesModal = dynamic(
  () => import("./ZkWatchLinesModal").then((mod) => ({ default: mod.ZkWatchLinesModal })),
  { ssr: false }
);

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
  linkableOrders = [],
  readOnly,
  delegatePreview = false,
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
  newlyAddedWatchIds,
  onWarehouseArrivalSeen,
  onNewZkLinesSeen,
  onNewlyAddedZkWatchSeen,
  onProsbaScopeRequested,
  focusWatchId,
  onFocusWatchHandled,
  onLiveAnnounce,
}: {
  watches: SalesZkWatch[];
  zkHintsByWatchId?: Map<string, ZkWatchOrderHints>;
  linkableOrders?: ZkLinkableOrder[];
  unseenWatchIds?: Set<string>;
  newLineKeysByWatchId?: Record<string, string[]>;
  newlyAddedWatchIds?: Set<string>;
  onWarehouseArrivalSeen?: (watchId: string) => void;
  onNewZkLinesSeen?: (watchId: string) => void;
  onNewlyAddedZkWatchSeen?: (watchId: string) => void;
  onProsbaScopeRequested?: (watchId: string) => void;
  /** Po wejściu z linku (#watch-…) — rozwiń miesiąc i podświetl kartę. */
  focusWatchId?: string | null;
  onFocusWatchHandled?: (watchId: string) => void;
  onLiveAnnounce?: (message: string) => void;
  readOnly?: boolean;
  delegatePreview?: boolean;
  tourPreview?: boolean;
  compact?: boolean;
  archived?: boolean;
  subiektReachable?: boolean;
  onClosed?: (watchId: string, closedAt: string) => void;
  onRestored?: (watch: SalesZkWatch) => void;
  onRefreshed?: (
    watch: SalesZkWatch,
    refreshDiff?: ZkWatchRefreshDiff,
    options?: { skipRouterRefresh?: boolean }
  ) => void;
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
  const zkVirtualEnabled = watches.length >= ZK_WATCH_LIST_VIRTUAL_THRESHOLD;
  const virtualItems = useMemo(
    () =>
      buildZkWatchListVirtualItems({
        groups,
        collapsedMonths,
        openModalWatchId,
      }),
    [groups, collapsedMonths, openModalWatchId]
  );
  const focusScrollKey = focusWatchId ? zkWatchListScrollKey(focusWatchId) : null;
  const virtualLayoutKey = `${virtualItems.length}\0${[...collapsedMonths].sort().join("\0")}\0${openModalWatchId ?? ""}`;
  const [linesModalFocusNote, setLinesModalFocusNote] = useState(false);
  const [closeSession, setCloseSession] = useState<ZkWatchClosePendingSession | null>(null);
  const [closePreviewWatchId, setClosePreviewWatchId] = useState<string | null>(null);
  const [closeFlowErrorByWatchId, setCloseFlowErrorByWatchId] = useState<
    Record<string, string>
  >({});
  const modalWatch = useMemo(
    () => (openModalWatchId ? watches.find((watch) => watch.id === openModalWatchId) : undefined),
    [openModalWatchId, watches]
  );
  const focusFlashHandledRef = useRef<string | null>(null);

  useEffect(() => {
    if (!focusWatchId) {
      focusFlashHandledRef.current = null;
      return;
    }
    if (focusFlashHandledRef.current === focusWatchId) return;
    if (!watches.some((watch) => watch.id === focusWatchId)) return;

    const monthKey = monthKeyForWatchInGroups(groups, focusWatchId);
    if (monthKey && !isZkMonthGroupExpanded(monthKey, collapsedMonths)) return;

    focusFlashHandledRef.current = focusWatchId;

    const focusedWatch = watches.find((watch) => watch.id === focusWatchId);
    const announce = focusedWatch
      ? `Przewinięto do ZK ${formatProsbaZkLinkNumber(focusedWatch.zk_number)}`
      : undefined;

    flashNotepadAnchor(`watch-${focusWatchId}`, {
      delayMs: zkVirtualEnabled ? 420 : 180,
      durationMs: 2400,
      announce,
      onAnnounce: onLiveAnnounce,
      onFound: () => onFocusWatchHandled?.(focusWatchId),
    });
  }, [focusWatchId, watches, groups, collapsedMonths, onFocusWatchHandled, onLiveAnnounce, zkVirtualEnabled]);

  const toggleMonth = useCallback((monthKey: string) => {
    dispatchUi({ type: "toggleMonth", monthKey });
  }, []);

  const expandAll = useCallback(() => {
    dispatchUi({ type: "expandAll", groups });
  }, [groups]);

  const collapseAll = useCallback(() => {
    dispatchUi({ type: "collapseAll", groups });
  }, [groups]);

  const closeLinesModal = useCallback(() => {
    dispatchUi({ type: "setModal", watchId: null });
    setLinesModalFocusNote(false);
  }, []);

  const dismissLinesModal = useCallback(
    (watchId: string) => {
      closeLinesModal();
      if (unseenWatchIds?.has(watchId)) {
        onWarehouseArrivalSeen?.(watchId);
      }
      if ((newLineKeysByWatchId?.[watchId]?.length ?? 0) > 0) {
        onNewZkLinesSeen?.(watchId);
      }
      if (newlyAddedWatchIds?.has(watchId)) {
        onNewlyAddedZkWatchSeen?.(watchId);
      }
    },
    [
      closeLinesModal,
      newLineKeysByWatchId,
      newlyAddedWatchIds,
      onNewZkLinesSeen,
      onNewlyAddedZkWatchSeen,
      onWarehouseArrivalSeen,
      unseenWatchIds,
    ]
  );

  const requestCloseWatch = useCallback(
    (watch: SalesZkWatch) => {
      setCloseFlowErrorByWatchId((prev) => {
        if (!(watch.id in prev)) return prev;
        const next = { ...prev };
        delete next[watch.id];
        return next;
      });
      setCloseSession({
        nonce: Date.now(),
        watch,
        linesModalOpen: openModalWatchId === watch.id,
        closeLinesModal: () => dismissLinesModal(watch.id),
      });
    },
    [dismissLinesModal, openModalWatchId]
  );

  const handleCloseFlowError = useCallback((watchId: string, message: string | null) => {
    setCloseFlowErrorByWatchId((prev) => {
      if (!message) {
        if (!(watchId in prev)) return prev;
        const next = { ...prev };
        delete next[watchId];
        return next;
      }
      if (prev[watchId] === message) return prev;
      return { ...prev, [watchId]: message };
    });
  }, []);

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
      <VirtualList
        items={virtualItems}
        threshold={ZK_WATCH_LIST_VIRTUAL_THRESHOLD}
        enabled={zkVirtualEnabled}
        listClassName={NOTATNIK_ZK_LIST_CLASS}
        scrollToKey={focusScrollKey}
        estimateSize={(_, item) =>
          item.kind === "month" ? ZK_MONTH_HEADER_ESTIMATE_PX : ZK_WATCH_CARD_ESTIMATE_PX
        }
        getItemKey={(item) => item.key}
        remeasureKey={virtualLayoutKey}
        renderItem={(item) => {
          if (item.kind === "month") {
            const group = item.group;
            const isOpen = item.isOpen;
            return (
              <button
                type="button"
                onClick={() => toggleMonth(group.key)}
                aria-expanded={isOpen}
                aria-label={`${group.label}, ${group.watches.length} ZK, ${isOpen ? "rozwinięte" : "zwinięte"}`}
                className="flex w-full items-center gap-2 border-y border-slate-200/70 bg-slate-50/80 px-3 py-2 text-left transition hover:bg-slate-100/80"
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
            );
          }

          const watch = item.watch;
          return (
            <ZkWatchCard
              watch={watch}
              anchorId={`watch-${watch.id}`}
              orderHints={zkHintsByWatchId?.get(watch.id)}
              readOnly={readOnly}
              delegatePreview={delegatePreview}
              tourPreview={tourPreview}
              compact={compact}
              archived={archived}
              subiektReachable={subiektReachable}
              onRequestCloseWatch={requestCloseWatch}
              closePreviewLoading={closePreviewWatchId === watch.id}
              closeFlowError={closeFlowErrorByWatchId[watch.id]}
              onRestored={onRestored}
              onRefreshed={onRefreshed}
              onDeleted={() => onDeleted?.(watch.id)}
              onLinesModalOpenChange={(open, options) => {
                dispatchUi({ type: "setModal", watchId: open ? watch.id : null });
                setLinesModalFocusNote(open ? (options?.focusNote ?? false) : false);
              }}
              hasNewWarehouseArrival={unseenWatchIds?.has(watch.id) ?? false}
              hasNewZkLines={(newLineKeysByWatchId?.[watch.id]?.length ?? 0) > 0}
              isNewlyAdded={newlyAddedWatchIds?.has(watch.id) ?? false}
              newLineKeys={newLineKeysByWatchId?.[watch.id]}
              onProsbaScopeRequested={onProsbaScopeRequested}
            />
          );
        }}
      />
      {modalWatch ? (
        <ZkWatchLinesModal
          watch={modalWatch}
          open
          readOnly={readOnly || delegatePreview}
          tourPreview={tourPreview}
          archived={archived}
          focusNote={linesModalFocusNote}
          linkableOrders={linkableOrders}
          orderHints={zkHintsByWatchId?.get(modalWatch.id)}
          matchedDeliveredLineKeys={zkHintsByWatchId?.get(modalWatch.id)?.matchedDeliveredLineKeys}
          newLineKeys={newLineKeysByWatchId?.[modalWatch.id]}
          lineCoverageByKey={zkHintsByWatchId?.get(modalWatch.id)?.lineCoverageByKey}
          inStockLineKeys={zkHintsByWatchId?.get(modalWatch.id)?.inStockLineKeys}
          informacjaReadyLineKeys={zkHintsByWatchId?.get(modalWatch.id)?.informacjaReadyLineKeys}
          informacjaAcknowledgedLineKeys={
            zkHintsByWatchId?.get(modalWatch.id)?.informacjaAcknowledgedLineKeys
          }
          scopeExcludedLineKeys={zkHintsByWatchId?.get(modalWatch.id)?.scopeExcludedLineKeys}
          onClose={() => dismissLinesModal(modalWatch.id)}
          onSaved={(updated) =>
            onRefreshed?.(updated, undefined, { skipRouterRefresh: true })
          }
        />
      ) : null}
      <ZkWatchClosePendingHost
        session={closeSession}
        readOnly={readOnly}
        delegatePreview={delegatePreview}
        tourPreview={tourPreview}
        onDismiss={() => setCloseSession(null)}
        onPreviewLoadingChange={setClosePreviewWatchId}
        onFlowError={handleCloseFlowError}
        onClosed={(watchId, closedAt) => {
          setCloseFlowErrorByWatchId((prev) => {
            if (!(watchId in prev)) return prev;
            const next = { ...prev };
            delete next[watchId];
            return next;
          });
          onClosed?.(watchId, closedAt);
        }}
      />
    </div>
  );
}
