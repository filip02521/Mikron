"use client";

import { useCallback, useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { plPozycja, plProsba } from "@/lib/ui/polish-plurals";
import { polishPluralWord } from "@/lib/email/polish-plural";
import { TeethPanelEmpty } from "@/components/zeby/TeethPanelSection";
import { TeethQueueSupplierCard } from "@/components/zeby/TeethQueueSupplierCard";
import {
  IconCalendar,
  IconClipboardList,
  IconTruck,
  IconX,
} from "@/components/icons/StrokeIcons";
import { detectTeethDuplicates } from "@/lib/teeth/teeth-duplicate-detect";
import type { TeethPanelReadinessContext } from "@/lib/teeth/teeth-panel-order-readiness";
import { resolveTeethGroupOrderFile, teethOrderFileGroupKey } from "@/lib/teeth/teeth-mark-ordered";
import type {
  TeethQueueGroup,
  TeethQueueItem,
  TeethPositionSelection,
} from "@/lib/data/teeth-queue-shared";
import { isScheduledItem } from "@/lib/data/teeth-queue-shared";
import {
  resolveTeethQueueEnteredAt,
  teethQueueWaitCalendarDays,
  formatTeethQueueWaitDays,
} from "@/lib/teeth/teeth-queue-wait";
import {
  teethOrderQueueState,
  teethOrderStateNeedsFix,
  teethOrderUnorderedPositions,
  teethSelectionsForItems,
  formatTeethSpecLabel,
  type TeethMarkScope,
} from "@/lib/teeth/teeth-queue-view-model";
import { parseTeethJaw, parseTeethKind } from "@/lib/teeth/teeth-catalog-types";

/** Zdanie stanu kolejki (DESIGN.md → Status Panel) zamiast rzędu kafelków z liczbami. */
export function QueueStatus({
  orders,
  ready,
  needsFix,
  oldestDays,
  onShowNeedsFix,
}: {
  orders: number;
  ready: number;
  needsFix: number;
  oldestDays: number;
  onShowNeedsFix?: () => void;
}) {
  return (
    <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-base font-semibold tracking-[-0.01em] text-slate-900 tabular-nums">
          {orders} {plProsba(orders)} w kolejce, {ready}{" "}
          {polishPluralWord(ready, "gotowa", "gotowe", "gotowych")} do zamówienia
        </p>
        <p className="mt-1 text-sm text-slate-600 tabular-nums">
          {needsFix > 0 ? (
            <span className="text-amber-800">
              {needsFix} do uzupełnienia - brak lub niepełna lista zębów.
            </span>
          ) : (
            "Wszystkie listy zębów są kompletne."
          )}{" "}
          <span className={cn(oldestDays > 5 && "font-medium text-red-700")}>
            Najdłużej czeka: {oldestDays > 0 ? formatTeethQueueWaitDays(oldestDays) : "od dziś"}.
          </span>
        </p>
      </div>
      {needsFix > 0 && onShowNeedsFix ? (
        <Button variant="secondary" className="shrink-0" onClick={onShowNeedsFix}>
          Pokaż {needsFix} do uzupełnienia
        </Button>
      ) : null}
    </Card>
  );
}

export function TeethPanelKolejkaView({
  groups,
  readinessCtx,
  positionSelection,
  pending,
  selectedPositionCount,
  selectedOrderCount,
  onSetPositions,
  onToggleSelectAllInGroup,
  onClearSelection,
  onRequestMarkPositionsOrdered,
  onMarkScheduleOrdered,
  onSetDeliveryDate,
  onEditSaved,
  onFileChanged,
  onShowNeedsFix,
}: {
  groups: TeethQueueGroup[];
  readinessCtx?: TeethPanelReadinessContext;
  positionSelection: Map<string, Set<number>>;
  pending: boolean;
  selectedPositionCount: number;
  selectedOrderCount: number;
  onSetPositions: (orderId: string, positions: number[], select: boolean) => void;
  onToggleSelectAllInGroup: (group: TeethQueueGroup) => void;
  onClearSelection: () => void;
  onRequestMarkPositionsOrdered: (
    selections: TeethPositionSelection[],
    supplierName?: string | null,
    scope?: TeethMarkScope,
  ) => void;
  onMarkScheduleOrdered: (supplierId: string, supplierName: string) => void;
  onSetDeliveryDate: () => void;
  onEditSaved?: (message?: string) => void;
  onFileChanged?: () => void;
  /** Włącza filtr „Tylko do uzupełnienia”; brak, gdy filtr już działa. */
  onShowNeedsFix?: () => void;
}) {
  const duplicates = useMemo(() => detectTeethDuplicates(groups), [groups]);
  const [showDuplicates, setShowDuplicates] = useState(false);

  const ordersById = useMemo(() => {
    const map = new Map<string, TeethQueueItem>();
    for (const group of groups) {
      for (const item of group.items) {
        if (!isScheduledItem(item)) map.set(item.id, item);
      }
    }
    return map;
  }, [groups]);

  const [fileStateOverrides, setFileStateOverrides] = useState<Map<string, boolean>>(new Map());
  const [overridesForGroups, setOverridesForGroups] = useState(groups);
  // Po przeładowaniu kolejki nie trzymaj lokalnych override’ów (mogą odblokować fałszywie).
  if (groups !== overridesForGroups) {
    setOverridesForGroups(groups);
    setFileStateOverrides(new Map());
  }

  const groupHasFile = useCallback(
    (groupKey: string, items: TeethQueueItem[]): boolean => {
      const override = fileStateOverrides.get(groupKey);
      if (override != null) return override;
      return resolveTeethGroupOrderFile(items).hasFile;
    },
    [fileStateOverrides],
  );

  const handleGroupFileChanged = useCallback(
    (groupKey: string, hasFile: boolean) => {
      setFileStateOverrides((prev) => new Map(prev).set(groupKey, hasFile));
      onFileChanged?.();
    },
    [onFileChanged],
  );

  const stats = useMemo(() => {
    let orders = 0;
    let ready = 0;
    let needsFix = 0;
    let oldestDays = 0;
    for (const item of ordersById.values()) {
      orders++;
      const state = teethOrderQueueState(item, readinessCtx);
      if (state === "ready") ready++;
      if (teethOrderStateNeedsFix(state)) needsFix++;
      const at = resolveTeethQueueEnteredAt(item);
      if (at) oldestDays = Math.max(oldestDays, teethQueueWaitCalendarDays(at));
    }
    return { orders, ready, needsFix, oldestDays };
  }, [ordersById, readinessCtx]);

  const selectionMissingFiles = useMemo(() => {
    const missing = new Set<string>();
    for (const orderId of positionSelection.keys()) {
      const order = ordersById.get(orderId);
      if (!order) continue;
      const key = teethOrderFileGroupKey(order);
      const siblings = [...ordersById.values()].filter((i) => teethOrderFileGroupKey(i) === key);
      if (!groupHasFile(key, siblings)) missing.add(order.supplier_name ?? "Bez dostawcy");
    }
    return [...missing];
  }, [positionSelection, ordersById, groupHasFile]);

  if (!groups.length || groups.every((g) => !g.items.length)) {
    return (
      <TeethPanelEmpty
        title="Brak pozycji spełniających filtry"
        description="Zmień filtry albo poczekaj na nowe prośby handlowców na zęby syntetyczne."
        icon={<IconClipboardList size={24} strokeWidth={1.75} />}
      />
    );
  }

  const selections = (): TeethPositionSelection[] =>
    [...positionSelection.entries()]
      .filter(([, positions]) => positions.size > 0)
      .map(([orderId, positions]) => ({ orderId, positions: [...positions] }));

  return (
    <>
      <QueueStatus
        orders={stats.orders}
        ready={stats.ready}
        needsFix={stats.needsFix}
        oldestDays={stats.oldestDays}
        onShowNeedsFix={onShowNeedsFix}
      />

      {duplicates.length > 0 ? (
        <Alert tone="warning" title={`Możliwe duplikaty: ${duplicates.length}`}>
          <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
            <p>Ten sam handlowiec prosi o te same zęby w kilku prośbach - sprawdź przed zamówieniem.</p>
            <button
              type="button"
              onClick={() => setShowDuplicates((v) => !v)}
              className="-my-2 inline-flex min-h-11 shrink-0 items-center rounded-md px-2 font-semibold text-amber-900 underline-offset-2 hover:underline sm:min-h-8"
              aria-expanded={showDuplicates}
            >
              {showDuplicates ? "Ukryj listę" : "Pokaż listę"}
            </button>
          </div>
          {showDuplicates ? (
            <ul className="mt-2 space-y-0.5 text-xs">
              {duplicates.map((d) => (
                <li key={`${d.salesPersonName}-${d.color}-${d.mould}-${d.jaw}-${d.kind}`}>
                  <span className="font-semibold">{d.salesPersonName}</span>:{" "}
                  {formatTeethSpecLabel({
                    color: d.color,
                    mould: d.mould,
                    jaw: parseTeethJaw(d.jaw),
                    kind: parseTeethKind(d.kind),
                  })}{" "}
                  - w {d.orderIds.length} {plProsba(d.orderIds.length)}
                </li>
              ))}
            </ul>
          ) : null}
        </Alert>
      ) : null}

      {groups.map((group) => {
        const items = group.items.filter((i): i is TeethQueueItem => !isScheduledItem(i));
        const fileKey = group.supplierId ?? "__no_supplier";
        const supplierId = group.supplierId ?? group.dueSchedule?.supplier_id ?? null;
        const groupSelections = teethSelectionsForItems(items, positionSelection);
        return (
          <TeethQueueSupplierCard
            key={fileKey}
            group={group}
            items={items}
            readinessCtx={readinessCtx}
            positionSelection={positionSelection}
            pending={pending}
            hasFile={groupHasFile(fileKey, items)}
            fileName={resolveTeethGroupOrderFile(items).fileName}
            onFileChanged={(hasFile) => handleGroupFileChanged(fileKey, hasFile)}
            onTogglePositions={onSetPositions}
            onToggleAll={() => onToggleSelectAllInGroup(group)}
            selectedTeethCount={groupSelections.reduce((sum, sel) => sum + sel.positions.length, 0)}
            onMarkGroup={() => {
              // Gdy coś zaznaczono u tego dostawcy — oznaczamy TYLKO zaznaczenie,
              // nigdy całego dostawcy „przy okazji”.
              if (groupSelections.length > 0) {
                onRequestMarkPositionsOrdered(groupSelections, group.supplierName, "selection");
                return;
              }
              const all = items
                .map((item) => ({ orderId: item.id, positions: teethOrderUnorderedPositions(item) }))
                .filter((sel) => sel.positions.length > 0);
              if (all.length > 0) {
                onRequestMarkPositionsOrdered(all, group.supplierName, "all");
              }
            }}
            onMarkSchedule={() => {
              if (supplierId) onMarkScheduleOrdered(supplierId, group.supplierName);
            }}
            onEditSaved={onEditSaved}
          />
        );
      })}

      {selectedPositionCount > 0 ? (
        <>
          <div aria-hidden className="h-20" />
          <div
            role="region"
            aria-label="Zaznaczone zęby"
            className={cn(
              "fixed inset-x-3 z-30 mx-auto max-w-3xl",
              // Telefon: nad dolną nawigacją i paskiem podglądu admina.
              "bottom-[calc(env(safe-area-inset-bottom)+4.75rem+var(--admin-preview-dock,0px))]",
              // Desktop: obok menu bocznego (--app-sidebar-w) i nad paskiem „Podgląd: …”.
              "md:left-[calc(var(--app-sidebar-w)+1.5rem)] md:right-6 md:bottom-[calc(1.5rem+var(--admin-preview-clearance,0px))]",
            )}
          >
            <div className="flex flex-col gap-2 rounded-[var(--radius-panel)] border border-indigo-200 bg-[var(--card)]/95 px-4 py-3 shadow-[var(--shadow-card-elevated)] backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 tabular-nums">
                  Zaznaczono {selectedPositionCount}{" "}
                  {polishPluralWord(selectedPositionCount, "ząb", "zęby", "zębów")}
                  <span className="font-normal text-slate-600">
                    {" "}
                    z {selectedOrderCount} {selectedOrderCount === 1 ? "prośby" : "próśb"}
                  </span>
                </p>
                {selectionMissingFiles.length > 0 ? (
                  <p className="text-xs text-amber-800">
                    Wgraj plik zamówienia u: {selectionMissingFiles.join(", ")}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onClearSelection}
                  className="min-h-11 sm:min-h-9"
                >
                  <IconX size={14} />
                  Wyczyść
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onSetDeliveryDate}
                  disabled={pending}
                  className="min-h-11 sm:min-h-9"
                >
                  <IconCalendar size={14} />
                  Data dostawy
                </Button>
                <Button
                  size="sm"
                  onClick={() => onRequestMarkPositionsOrdered(selections(), null, "selection")}
                  disabled={pending || selectionMissingFiles.length > 0}
                  className="min-h-11 sm:min-h-9"
                  title={
                    selectionMissingFiles.length > 0
                      ? "Wgraj plik zamówienia u każdego zaznaczonego dostawcy"
                      : `Oznacz ${selectedPositionCount} ${plPozycja(selectedPositionCount)} jako zamówione`
                  }
                >
                  <IconTruck size={15} />
                  Oznacz zaznaczone ({selectedPositionCount})
                </Button>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
