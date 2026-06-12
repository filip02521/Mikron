"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import type { SalesZkWatch } from "@/types/database";
import type { ZkWatchOrderHints } from "@/lib/sales/zk-watch-order-link";
import { groupZkWatchesByMonth } from "@/lib/sales/zk-watch-sort";
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
import { panelTextLinkClass } from "@/lib/ui/ontime-theme";
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
  onWatchSeen,
  focusWatchId,
  onFocusWatchHandled,
  onLiveAnnounce,
}: {
  watches: SalesZkWatch[];
  zkHintsByWatchId?: Map<string, ZkWatchOrderHints>;
  unseenWatchIds?: Set<string>;
  onWatchSeen?: (watchId: string) => void;
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
  onRefreshed?: (watch: SalesZkWatch) => void;
  onDeleted?: (watchId: string) => void;
}) {
  const groups = useMemo(() => groupZkWatchesByMonth(watches), [watches]);
  const groupsSignature = useMemo(() => zkWatchMonthGroupsSignature(groups), [groups]);

  const [collapsedMonths, setCollapsedMonths] = useState<Set<string>>(() =>
    defaultCollapsedZkMonthKeys(groups)
  );
  const [openModalWatchId, setOpenModalWatchId] = useState<string | null>(null);
  const [appliedGroupsSignature, setAppliedGroupsSignature] = useState(groupsSignature);
  const [appliedFocusWatchId, setAppliedFocusWatchId] = useState<string | null>(null);

  if (openModalWatchId && !watches.some((watch) => watch.id === openModalWatchId)) {
    setOpenModalWatchId(null);
  }

  if (groupsSignature !== appliedGroupsSignature) {
    setAppliedGroupsSignature(groupsSignature);
    setCollapsedMonths((prev) => mergeZkMonthCollapseOnGroupsChange(prev, groups));
  }

  if (focusWatchId && focusWatchId !== appliedFocusWatchId) {
    const monthKey = monthKeyForWatchInGroups(groups, focusWatchId);
    if (monthKey) {
      setAppliedFocusWatchId(focusWatchId);
      setCollapsedMonths((prev) => expandMonthGroupKey(prev, monthKey));
    }
  }

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
    setCollapsedMonths((prev) => toggleZkMonthGroupCollapsed(prev, monthKey));
  }, []);

  const expandAll = useCallback(() => {
    setCollapsedMonths(expandAllZkMonthGroups(groups));
  }, [groups]);

  const collapseAll = useCallback(() => {
    setCollapsedMonths(collapseAllZkMonthGroups(groups));
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
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
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
                  <li key={watch.id} id={`watch-${watch.id}`}>
                    <ZkWatchCard
                      watch={watch}
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
                        setOpenModalWatchId(open ? watch.id : null);
                      }}
                      hasNewWarehouseArrival={unseenWatchIds?.has(watch.id) ?? false}
                      onWatchSeen={onWatchSeen}
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
