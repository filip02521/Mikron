"use client";

import { useCallback, useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { plPozycja, plProsba } from "@/lib/ui/polish-plurals";
import { polishPluralWord } from "@/lib/email/polish-plural";
import { TeethPanelEmpty } from "@/components/zeby/TeethPanelSection";
import { TeethQueueSupplierCard } from "@/components/zeby/TeethQueueSupplierCard";
import {
  IconAlertCircle,
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

function StatTile({
  label,
  value,
  hint,
  tone = "slate",
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "slate" | "indigo" | "amber" | "red";
}) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-white px-3 py-2.5 shadow-sm sm:px-4 sm:py-3",
        tone === "amber" && "border-amber-200 bg-amber-50/60",
        tone === "red" && "border-red-200 bg-red-50/50",
        tone === "indigo" && "border-indigo-200",
        tone === "slate" && "border-slate-200",
      )}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p
        className={cn(
          "mt-0.5 text-xl font-semibold tabular-nums sm:text-2xl",
          tone === "amber" ? "text-amber-800" : tone === "red" ? "text-red-700" : "text-slate-900",
        )}
      >
        {value}
      </p>
      {hint ? <p className="hidden text-xs text-slate-500 sm:block">{hint}</p> : null}
    </div>
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
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Prośby w kolejce" value={stats.orders} tone="indigo" />
        <StatTile
          label="Gotowe do zamówienia"
          value={stats.ready}
          hint={stats.ready > 0 ? "kompletna lista zębów" : undefined}
        />
        <StatTile
          label="Do uzupełnienia"
          value={stats.needsFix}
          tone={stats.needsFix > 0 ? "amber" : "slate"}
          hint={stats.needsFix > 0 ? "brak lub niepełna lista" : "wszystko kompletne"}
        />
        <StatTile
          label="Najdłużej czeka"
          value={stats.oldestDays > 0 ? formatTeethQueueWaitDays(stats.oldestDays) : "dziś"}
          tone={stats.oldestDays > 5 ? "red" : "slate"}
        />
      </div>

      {duplicates.length > 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm text-amber-900">
          <div className="flex items-start gap-2">
            <IconAlertCircle size={16} className="mt-0.5 text-amber-600" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">Możliwe duplikaty: {duplicates.length}</p>
              <p className="text-xs text-amber-800">
                Ten sam handlowiec prosi o te same zęby w kilku prośbach — sprawdź przed zamówieniem.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowDuplicates((v) => !v)}
              className="shrink-0 rounded-md px-2 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-100"
              aria-expanded={showDuplicates}
            >
              {showDuplicates ? "Ukryj" : "Pokaż"}
            </button>
          </div>
          {showDuplicates ? (
            <ul className="mt-2 space-y-0.5 pl-6 text-xs">
              {duplicates.map((d) => (
                <li key={`${d.salesPersonName}-${d.color}-${d.mould}-${d.jaw}-${d.kind}`}>
                  <span className="font-semibold">{d.salesPersonName}</span>:{" "}
                  {formatTeethSpecLabel({
                    color: d.color,
                    mould: d.mould,
                    jaw: parseTeethJaw(d.jaw),
                    kind: parseTeethKind(d.kind),
                  })}{" "}
                  — w {d.orderIds.length} {plProsba(d.orderIds.length)}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
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
              "fixed inset-x-3 z-40 mx-auto max-w-3xl",
              // Telefon: nad dolną nawigacją i paskiem podglądu admina.
              "bottom-[calc(env(safe-area-inset-bottom)+4.75rem+var(--admin-preview-dock,0px))]",
              // Desktop: obok sidebara (16rem) i nad paskiem „Podgląd: …”.
              "md:left-[calc(16rem+1.5rem)] md:right-6 md:bottom-[calc(1.5rem+var(--admin-preview-clearance,0px))]",
            )}
          >
            <div className="flex flex-col gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white shadow-2xl sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold">
                  Zaznaczono {selectedPositionCount}{" "}
                  {polishPluralWord(selectedPositionCount, "ząb", "zęby", "zębów")}
                  <span className="font-normal text-slate-300">
                    {" "}
                    z {selectedOrderCount} {selectedOrderCount === 1 ? "prośby" : "próśb"}
                  </span>
                </p>
                {selectionMissingFiles.length > 0 ? (
                  <p className="text-xs text-amber-300">
                    Brak pliku zamówienia: {selectionMissingFiles.join(", ")}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onClearSelection}
                  className="min-h-9 text-slate-300 hover:bg-white/10 hover:text-white"
                >
                  <IconX size={14} />
                  Wyczyść
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onSetDeliveryDate}
                  disabled={pending}
                  className="min-h-9 text-slate-100 hover:bg-white/10 hover:text-white"
                >
                  <IconCalendar size={14} />
                  Data dostawy
                </Button>
                <Button
                  size="sm"
                  onClick={() => onRequestMarkPositionsOrdered(selections(), null, "selection")}
                  disabled={pending || selectionMissingFiles.length > 0}
                  className="min-h-9"
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
