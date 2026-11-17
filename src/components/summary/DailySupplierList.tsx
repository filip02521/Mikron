"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { DailyPanelSubsectionBar, dailyPanelQueueShellClass } from "@/components/summary/DailyPanelSubsectionBar";
import { DailySupplierRow } from "@/components/summary/DailySupplierRow";
import { useSupplierStockSignals } from "@/components/summary/SupplierStockSignal";
import type { DailyPanelRunFn } from "@/components/summary/useDailyPanelRunner";
import { useZdAutomatOrderSheet } from "@/components/summary/useZdAutomatOrderSheet";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { cn } from "@/lib/cn";
import { polishPluralWord } from "@/lib/email/polish-plural";
import {
  DAILY_SUPPLIER_GROUP_LABEL,
  DAILY_SUPPLIER_GROUP_ORDER,
  DAILY_SUPPLIER_SOURCE_LABEL,
  DAILY_SUPPLIER_SOURCE_ORDER,
  countDailySupplierSources,
  type DailySupplierGroup,
  type DailySupplierRow as DailySupplierRowData,
  type DailySupplierSource,
} from "@/lib/orders/daily-supplier-rows";
import {
  dailyPanelQueueSectionScrollClass,
  dailySupplierGroupAnchor,
  DAILY_SUPPLIER_LIST_ANCHOR,
} from "@/lib/orders/daily-panel-section-anchors";
import type { SupplierSummaryMeta } from "@/lib/orders/summary-workspace";
import {
  checkboxBrandClass,
  panelChoiceChipClass,
  panelChoiceChipIdleClass,
  panelChoiceChipSelectedClass,
  panelDashedActionClass,
  panelSubsectionInsetClass,
  panelTypography,
} from "@/lib/ui/ontime-theme";

const GROUP_REASON: Record<DailySupplierGroup, string> = {
  send: "automat przygotował zamówienie",
  order: "analiza Braki albo prośby mówią: zamów",
  early: "zapas nie wystarczy do planowego zamówienia",
  shift: "termin dziś, stan wystarcza",
  manual: "brak aktualnej analizy stanu albo urlop dostawcy",
  done: "zamówienie wysłane albo ZD utworzone dziś",
};

/** Ile wierszy grupy widać od razu: [próg, podgląd]; długa lista nie spycha próśb handlowców. */
const GROUP_PREVIEW: Record<DailySupplierGroup, [over: number, show: number]> = {
  send: [20, 15],
  order: [20, 15],
  early: [8, 6],
  shift: [8, 5],
  manual: [8, 5],
  done: [0, 0],
};

/** Zbiorcze „Zamówione” dotyczy terminu harmonogramu — nie wiersza, w którym czeka albo poszło zamówienie automatu. */
const canSelect = (r: DailySupplierRowData) => r.schedule != null && r.group !== "send" && r.group !== "done";

function visibleRows(group: DailySupplierGroup, rows: readonly DailySupplierRowData[], expanded: boolean) {
  const [over, show] = GROUP_PREVIEW[group];
  return rows.length > over && !expanded ? rows.slice(0, show) : rows;
}

/** Zbiorcze „Zamówione” dla zaznaczonych dostawców z terminem (to samo zaznaczenie co w widoku Dziś). */
export type DailySupplierBulk = {
  selected: Record<string, boolean>;
  onToggle: (supplierId: string) => void;
  onSelectAllInScope: (checked: boolean, supplierIds: string[]) => void;
  /** Dostaje wyłącznie zaznaczone wiersze widoczne z polem wyboru — nic spoza ekranu. */
  onBulkOrdered: (supplierIds: string[]) => void;
  isBulkPending: boolean;
};

/**
 * Panel dzienny → „Dziś”: jeden wiersz na dostawcę, grupy według tego, co zrobić
 * (docs/plans/panel-dzienny-lista-dostawcow.md).
 */
export function DailySupplierList({
  rows: allRows,
  supplierMeta,
  todayKey,
  automatExpiresBySupplier = {},
  source: sourceIn = null,
  onSourceChange,
  onOpenSupplier,
  onVacation,
  onEdit,
  run,
  isScopePending,
  bulk,
}: {
  rows: readonly DailySupplierRowData[];
  /** Filtr źródła (z adresu); źródło bez wierszy działa jak brak filtra. */
  source?: DailySupplierSource | null;
  onSourceChange?: (next: DailySupplierSource | null) => void;
  supplierMeta: Record<string, SupplierSummaryMeta>;
  /** „Dziś” w Warszawie (YYYY-MM-DD) — daty względne w szczegółach wiersza. */
  todayKey: string;
  /** Dostawca → dzień, w którym czekające zamówienie automatu wygasa. */
  automatExpiresBySupplier?: Record<string, string | null>;
  onOpenSupplier: (id: string) => void;
  onVacation: (id: string) => void;
  onEdit: (id: string) => void;
  run: DailyPanelRunFn;
  isScopePending: (scope: string) => boolean;
  bulk?: DailySupplierBulk;
}) {
  const automat = useZdAutomatOrderSheet();
  const { signals } = useSupplierStockSignals();
  const [expandedGroups, setExpandedGroups] = useState<ReadonlySet<DailySupplierGroup>>(new Set());
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const sourceCounts = useMemo(() => countDailySupplierSources(allRows), [allRows]);
  const source = sourceIn && sourceCounts[sourceIn] > 0 ? sourceIn : null;
  const rows = useMemo(() => (source ? allRows.filter((r) => r.sources.includes(source)) : allRows), [allRows, source]);
  const byGroup = useMemo(() => {
    const map = new Map<DailySupplierGroup, DailySupplierRowData[]>();
    for (const r of rows) {
      const list = map.get(r.group);
      if (list) list.push(r);
      else map.set(r.group, [r]);
    }
    return map;
  }, [rows]);
  if (!allRows.length) return null;
  const openCount = rows.length - (byGroup.get("done")?.length ?? 0);
  const allOpenCount = allRows.filter((r) => r.group !== "done").length;
  const showChips = Boolean(onSourceChange) && DAILY_SUPPLIER_SOURCE_ORDER.filter((s) => sourceCounts[s] > 0).length > 1;
  const chip = (key: DailySupplierSource | null, label: string, count: number) => (
    <button
      key={key ?? "all"}
      type="button"
      aria-pressed={source === key}
      // Wysokość chipa filtra z DESIGN.md (0.375rem × 0.75rem); wspólna klasa ma py-2 pod wybór w formularzach.
      className={cn(panelChoiceChipClass, source === key ? panelChoiceChipSelectedClass : panelChoiceChipIdleClass, "py-1.5 max-sm:min-h-11")}
      onClick={() => onSourceChange?.(key)}
    >
      {label} <span className={cn("tabular-nums", source === key ? "text-indigo-700" : "text-slate-500")}>{count}</span>
    </button>
  );

  // „Wszystkie” zaznacza tylko to, co widać — „Zamówione (N)” nie obejmie wiersza schowanego pod „Pokaż wszystkie”.
  const visibleScheduledIds = DAILY_SUPPLIER_GROUP_ORDER.flatMap((g) =>
    visibleRows(g, byGroup.get(g) ?? [], expandedGroups.has(g))
      .filter(canSelect)
      .map((r) => r.supplierId)
  );
  // Liczy się tylko zaznaczenie, które widać: wiersz, który po odświeżeniu stracił pole wyboru (np. doszło
  // zamówienie automatu) albo schował się pod „Pokaż wszystkie”, nie wchodzi do „Zamówione (N)”.
  // Gdy lista ma pola wyboru, wiersze bez pola trzymają to samo wcięcie — nazwy stoją w jednej linii pionowej.
  const hasSelectable = !!bulk && rows.some(canSelect);
  const selectedIds = bulk ? visibleScheduledIds.filter((id) => bulk.selected[id]) : [];
  const selectedCount = selectedIds.length;
  const allSelected = visibleScheduledIds.length > 0 && selectedCount === visibleScheduledIds.length;
  // Zaznaczeni z pilnymi pozycjami Do ZD — „Zamówione” bez ZD to częsty błąd.
  const selectedWithUrgent = selectedIds.filter((id) => (signals[id]?.criticalCount ?? 0) > 0).length;

  const bulkAction =
    bulk && visibleScheduledIds.length > 0 ? (
      <div className="flex flex-wrap items-center justify-end gap-2">
        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-slate-600 sm:min-h-0">
          <input
            type="checkbox"
            className={cn("h-4 w-4", checkboxBrandClass)}
            checked={allSelected}
            onChange={(e) => bulk.onSelectAllInScope(e.target.checked, visibleScheduledIds)}
          />
          Zaznacz wszystkie
        </label>
        {/* Przycisk pojawia się z zaznaczeniem — wyłączony „Zamówione (0)” był tylko szumem w nagłówku. */}
        {selectedCount > 0 ? (
          <Button
            size="sm"
            variant="secondary"
            disabled={bulk.isBulkPending}
            className="h-11 sm:h-7"
            onClick={() => (selectedCount > 1 || selectedWithUrgent > 0 ? setBulkConfirmOpen(true) : bulk.onBulkOrdered(selectedIds))}
          >
            Zamówione ({selectedCount})
          </Button>
        ) : null}
      </div>
    ) : null;

  return (
    <section id={DAILY_SUPPLIER_LIST_ANCHOR} className={cn(dailyPanelQueueSectionScrollClass, dailyPanelQueueShellClass())}>
      {bulk ? (
        <ConfirmDialog
          open={bulkConfirmOpen}
          title={
            selectedCount > 1
              ? `Oznaczyć ${selectedCount} ${polishPluralWord(selectedCount, "dostawcę", "dostawców", "dostawców")} jako zamówionych?`
              : "Oznaczyć jako zamówione?"
          }
          message={[
            selectedWithUrgent > 0 && selectedCount === 1
              ? "Ten dostawca ma pilne pozycje Do ZD w analizie Braki - upewnij się, że ZD jest przygotowane w Subiekcie."
              : selectedWithUrgent > 0
                ? `${selectedWithUrgent} z ${selectedCount} ${polishPluralWord(selectedWithUrgent, "ma", "mają", "ma")} pilne pozycje Do ZD w analizie Braki - upewnij się, że ZD jest przygotowane w Subiekcie.`
                : null,
            "Po potwierdzeniu masz 10 sekund na cofnięcie całej operacji.",
          ]
            .filter(Boolean)
            .join(" ")}
          confirmLabel={`Zamówione (${selectedCount})`}
          pending={bulk.isBulkPending}
          onCancel={() => setBulkConfirmOpen(false)}
          onConfirm={() => {
            setBulkConfirmOpen(false);
            bulk.onBulkOrdered(selectedIds);
          }}
        />
      ) : null}
      <DailyPanelSubsectionBar
        title="Dostawcy na dziś"
        // Z chipami filtra liczba jest już w „Wszyscy N” — nagłówek jej nie powtarza, dopóki filtr nic nie zawęża.
        count={showChips && !source ? undefined : openCount}
        countUnit={{ one: "dostawca", few: "dostawcy", many: "dostawców" }}
        action={bulkAction}
        compact
      />
      {showChips ? (
        <div role="group" aria-label="Filtr źródła" className={cn("flex flex-wrap items-center gap-1.5 py-3", panelSubsectionInsetClass)}>
          {chip(null, "Wszyscy", allOpenCount)}
          {DAILY_SUPPLIER_SOURCE_ORDER.filter((s) => sourceCounts[s] > 0).map((s) => chip(s, DAILY_SUPPLIER_SOURCE_LABEL[s], sourceCounts[s]))}
        </div>
      ) : null}
      {DAILY_SUPPLIER_GROUP_ORDER.map((group) => {
        const groupRows = byGroup.get(group);
        if (!groupRows?.length) return null;
        const expanded = expandedGroups.has(group);
        const shown = visibleRows(group, groupRows, expanded);
        const [over, show] = GROUP_PREVIEW[group];
        const label = DAILY_SUPPLIER_GROUP_LABEL[group];
        return (
          <section
            key={group}
            id={dailySupplierGroupAnchor(group)}
            aria-label={label}
            className={cn(dailyPanelQueueSectionScrollClass, "border-t border-slate-200")}
          >
            <div className={cn("flex flex-wrap items-baseline gap-x-2 gap-y-0.5 pb-1.5 pt-4", panelSubsectionInsetClass)}>
              <h5 className={panelTypography.sectionTitle}>{label}</h5>
              <span className={cn("tabular-nums", panelTypography.rowMeta)}>{groupRows.length}</span>
              <span className={panelTypography.rowMeta}>· {GROUP_REASON[group]}</span>
            </div>
            {shown.length ? (
              <ul className="divide-y divide-slate-100">
                {shown.map((row) => (
                  <DailySupplierRow
                    key={row.supplierId}
                    row={row}
                    canOpen={supplierMeta[row.supplierId] != null}
                    meta={supplierMeta[row.supplierId]}
                    todayKey={todayKey}
                    expiresKey={automatExpiresBySupplier[row.supplierId] ?? null}
                    onOpenSupplier={onOpenSupplier}
                    onVacation={onVacation}
                    onEdit={onEdit}
                    run={run}
                    pending={isScopePending(row.supplierId)}
                    automat={automat}
                    checked={bulk?.selected[row.supplierId]}
                    onToggle={bulk && canSelect(row) ? () => bulk.onToggle(row.supplierId) : undefined}
                    reserveCheckbox={hasSelectable}
                  />
                ))}
              </ul>
            ) : null}
            {groupRows.length > over ? (
              <div className={cn("pb-3 pt-1", panelSubsectionInsetClass)}>
                <button
                  type="button"
                  className={cn("min-h-10 sm:min-h-9", panelDashedActionClass)}
                  onClick={() => {
                    // Zwijane wiersze tracą zaznaczenie — „Zamówione (N)” obejmuje tylko to, co widać.
                    if (expanded && bulk) {
                      const hidden = groupRows.slice(show).filter((r) => bulk.selected[r.supplierId]).map((r) => r.supplierId);
                      if (hidden.length) bulk.onSelectAllInScope(false, hidden);
                    }
                    setExpandedGroups((prev) => {
                      const next = new Set(prev);
                      if (next.has(group)) next.delete(group);
                      else next.add(group);
                      return next;
                    });
                  }}
                  aria-expanded={expanded}
                >
                  {expanded
                    ? "Zwiń listę"
                    : show === 0
                      ? `Pokaż (${groupRows.length})`
                      : `Pokaż wszystkie (${groupRows.length}) - jeszcze ${groupRows.length - show}`}
                </button>
              </div>
            ) : null}
          </section>
        );
      })}
      <p className={cn("border-t border-slate-200 py-2.5 text-right", panelSubsectionInsetClass, panelTypography.rowMeta)}>
        <Link href="/zakupy/braki" className="font-medium text-indigo-700 underline underline-offset-2 hover:text-indigo-900">
          Wszystkie braki
        </Link>
      </p>
      {automat.sheet}
    </section>
  );
}
