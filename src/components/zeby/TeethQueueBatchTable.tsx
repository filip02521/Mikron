"use client";

import { Fragment, useMemo } from "react";
import { cn } from "@/lib/cn";
import { useTeethProductInfo } from "@/components/layout/TeethExemptContext";
import { checkboxBrandClass, panelTypography } from "@/lib/ui/ontime-theme";
import {
  teethPanelBatchStripClass,
  teethPanelEditLinkClass,
  teethPanelIncompleteShellClass,
  teethPanelIncompleteTitleClass,
  teethPanelIncompleteDetailClass,
} from "@/lib/teeth/teeth-panel-ui";
import { TeethPanelEditOrderTrigger } from "@/components/zeby/TeethPanelEditOrderTrigger";
import { ProcurementSalesRequestNote } from "@/components/orders/ProcurementSalesRequestNote";
import {
  orderHasIncompleteTeethSpec,
  orderHasTeethList,
  orderHasTeethSpec,
} from "@/lib/teeth/teeth-panel-filters";
import { TEETH_QUEUE_HEADER_DATA_LABEL, teethQueueOrderNeedsHeaderData } from "@/lib/teeth/teeth-queue-gate";
import {
  teethPanelReadinessContextFromMaps,
} from "@/lib/teeth/teeth-panel-order-readiness";
import {
  TEETH_KIND_LABELS,
  type TeethJaw,
  type TeethKind,
} from "@/lib/teeth/teeth-catalog";
import { parseTeethJaw, parseTeethKind } from "@/lib/teeth/teeth-catalog-types";
import { jawRequiredForKind } from "@/lib/teeth/teeth-mould-shape-groups";
import { Badge } from "@/components/ui/Badge";
import { plPozycja } from "@/lib/ui/polish-plurals";
import type { TeethQueueItem } from "@/lib/data/teeth-queue";

const JAW_LABELS = { upper: "Góra", lower: "Dół" } as const;

function jawLabel(jaw: TeethJaw | null, kind: TeethKind | null): string {
  if (!kind || !jawRequiredForKind(kind)) return "—";
  if (jaw === "upper") return JAW_LABELS.upper;
  if (jaw === "lower") return JAW_LABELS.lower;
  return "—";
}

function kindLabel(kind: TeethKind | null): string {
  if (!kind) return "—";
  return TEETH_KIND_LABELS[kind];
}

type OrderEntry = {
  orderId: string;
  item: TeethQueueItem;
  unorderedPositions: number[];
  orderedCount: number;
  totalCount: number;
};

type GroupRow = {
  key: string;
  color: string;
  mould: string | null;
  jaw: TeethJaw | null;
  kind: TeethKind | null;
  salesPersonName: string | null;
  orderEntries: OrderEntry[];
  totalUnordered: number;
  totalOrdered: number;
  totalCount: number;
  isFirstRowOfSalesPerson: boolean;
};

function buildGroupRows(items: TeethQueueItem[]): GroupRow[] {
  const rows: GroupRow[] = [];
  const groupMap = new Map<string, GroupRow>();

  for (const item of items) {
    const salesName = item.sales_person_name ?? null;
    const salesKey = salesName ?? "__no_sales";
    const details = item.teeth_details ?? [];

    if (details.length === 0) {
      const groupKey = `${salesKey}|__empty`;
      let g = groupMap.get(groupKey);
      if (!g) {
        g = {
          key: groupKey,
          color: "",
          mould: null,
          jaw: null,
          kind: null,
          salesPersonName: salesName,
          orderEntries: [],
          totalUnordered: 0,
          totalOrdered: 0,
          totalCount: 0,
          isFirstRowOfSalesPerson: false,
        };
        groupMap.set(groupKey, g);
        rows.push(g);
      }
      g.orderEntries.push({
        orderId: item.id,
        item,
        unorderedPositions: [],
        orderedCount: 0,
        totalCount: 0,
      });
      continue;
    }

    // Grupuj pozycje w ramach tego zamówienia po specyfikacji
    const specGroups = new Map<
      string,
      { color: string; mould: string | null; jaw: TeethJaw | null; kind: TeethKind | null; unordered: number[]; ordered: number; total: number }
    >();
    for (const d of details) {
      const jaw = parseTeethJaw(d.jaw, d.size);
      const kind = parseTeethKind(d.kind);
      const specKey = `${d.color}|${d.mould ?? ""}|${jaw ?? ""}|${kind ?? ""}`;
      let sg = specGroups.get(specKey);
      if (!sg) {
        sg = { color: d.color, mould: d.mould, jaw, kind, unordered: [], ordered: 0, total: 0 };
        specGroups.set(specKey, sg);
      }
      sg.total++;
      if (d.ordered_at != null) {
        sg.ordered++;
      } else {
        sg.unordered.push(d.position);
      }
    }

    // Dodaj każdą specyfikację do grupy globalnej (per handlowiec + spec)
    for (const [specKey, sg] of specGroups) {
      const groupKey = `${salesKey}|${specKey}`;
      let g = groupMap.get(groupKey);
      if (!g) {
        g = {
          key: groupKey,
          color: sg.color,
          mould: sg.mould,
          jaw: sg.jaw,
          kind: sg.kind,
          salesPersonName: salesName,
          orderEntries: [],
          totalUnordered: 0,
          totalOrdered: 0,
          totalCount: 0,
          isFirstRowOfSalesPerson: false,
        };
        groupMap.set(groupKey, g);
        rows.push(g);
      }
      g.orderEntries.push({
        orderId: item.id,
        item,
        unorderedPositions: sg.unordered,
        orderedCount: sg.ordered,
        totalCount: sg.total,
      });
      g.totalUnordered += sg.unordered.length;
      g.totalOrdered += sg.ordered;
      g.totalCount += sg.total;
    }
  }

  // Oznacz pierwszy wiersz każdego handlowca
  let prevSales: string | null = "__init__";
  for (const g of rows) {
    if (g.salesPersonName !== prevSales) {
      g.isFirstRowOfSalesPerson = true;
      prevSales = g.salesPersonName;
    }
  }

  return rows;
}

export function TeethQueueBatchTable({
  items,
  positionSelection,
  onTogglePosition,
  onEditSaved,
  alwaysShowEdit = false,
}: {
  items: TeethQueueItem[];
  positionSelection: Map<string, Set<number>>;
  onTogglePosition: (orderId: string, position: number) => void;
  onEditSaved?: (message?: string) => void;
  /** Pokaż przycisk "Edytuj listę" przy każdej pozycji, nie tylko przy problemowych (np. weryfikacja OCR). */
  alwaysShowEdit?: boolean;
}) {
  const teethProductInfo = useTeethProductInfo();
  const readinessCtx = useMemo(
    () => teethPanelReadinessContextFromMaps(teethProductInfo),
    [teethProductInfo],
  );

  const groupRows = useMemo(() => buildGroupRows(items), [items]);

  const totalPieces = groupRows.reduce((sum, r) => sum + r.totalCount, 0);
  const orderCount = items.length;

  // Agreguj badge'e problemów per handlowiec
  const salesPersonIssueBadges = useMemo(() => {
    const map = new Map<string, { missingList: boolean; incomplete: boolean; needsHeader: boolean; informacja: boolean; notes: { orderId: string; note: string }[] }>();
    for (const item of items) {
      const salesName = item.sales_person_name ?? null;
      if (!salesName) continue;
      const hasList = orderHasTeethList(item);
      const hasIncomplete = orderHasIncompleteTeethSpec(item, readinessCtx);
      const needsHeader = teethQueueOrderNeedsHeaderData(item);
      let entry = map.get(salesName);
      if (!entry) {
        entry = { missingList: false, incomplete: false, needsHeader: false, informacja: false, notes: [] };
        map.set(salesName, entry);
      }
      if (!hasList) entry.missingList = true;
      if (hasIncomplete) entry.incomplete = true;
      if (needsHeader) entry.needsHeader = true;
      if (item.request_kind === "informacja") entry.informacja = true;
      if (item.sales_request_note) entry.notes.push({ orderId: item.id, note: item.sales_request_note });
    }
    return map;
  }, [items, readinessCtx]);

  // Mapa handlowców → indeks dla naprzemiennego kolorowania
  const salesPersonIndexMap = useMemo(() => {
    const map = new Map<string | null, number>();
    let idx = 0;
    for (const row of groupRows) {
      if (!map.has(row.salesPersonName)) {
        map.set(row.salesPersonName, idx++);
      }
    }
    return map;
  }, [groupRows]);

  const ordersWithIssues = items.filter((item) => {
    const hasList = orderHasTeethList(item);
    const hasSpec = orderHasTeethSpec(item, readinessCtx);
    const hasIncomplete = orderHasIncompleteTeethSpec(item, readinessCtx);
    const needsHeader = teethQueueOrderNeedsHeaderData(item);
    return !hasSpec || hasIncomplete || !hasList || needsHeader;
  });

  const salesPersonRowCounts = useMemo(() => {
    const map = new Map<string | null, number>();
    for (const row of groupRows) {
      const name = row.salesPersonName;
      map.set(name, (map.get(name) ?? 0) + 1);
    }
    return map;
  }, [groupRows]);

  return (
    <div className={teethPanelBatchStripClass}>
      <div className="space-y-2 py-2.5">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 px-3 sm:px-4 lg:px-5">
          <span className={panelTypography.rowTitle}>Do zamówienia u dostawcy</span>
          <span className={cn(panelTypography.caption, "text-slate-600")}>
            {totalPieces} {plPozycja(totalPieces)} · {orderCount}{" "}
            {orderCount === 1 ? "prośba" : orderCount < 5 ? "prośby" : "prośb"}
          </span>
          {ordersWithIssues.length > 0 ? (
            <Badge variant="warning" className="text-[10px]">
              {ordersWithIssues.length} do uzupełnienia
            </Badge>
          ) : null}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200/80 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                <th className="py-1.5 pl-3 pr-1 sm:pl-4 lg:pl-5" />
                <th className="py-1.5 px-2">Kolor</th>
                <th className="py-1.5 px-2">Fason</th>
                <th className="py-1.5 px-2">Szczęka</th>
                <th className="py-1.5 px-2">Typ</th>
                <th className="py-1.5 px-2 text-right tabular-nums">Szt.</th>
                <th className="py-1.5 pr-3 pl-2 sm:pr-4 lg:pr-5" />
              </tr>
            </thead>
            <tbody>
              {groupRows.map((row, index) => {
                const noSpec = row.totalCount === 0;
                const allOrdered = row.totalCount > 0 && row.totalOrdered === row.totalCount;

                // Sprawdź zaznaczenie wszystkich pozycji w grupie (wiele zamówień)
                let totalUnorderedSel = 0;
                for (const entry of row.orderEntries) {
      const sel = positionSelection.get(entry.orderId);
      totalUnorderedSel += entry.unorderedPositions.filter((p) => sel?.has(p)).length;
    }
                const allUnorderedSelected = row.totalUnordered > 0 && totalUnorderedSel === row.totalUnordered;
                const someSelected = totalUnorderedSel > 0 && !allUnorderedSelected;

                // Agreguj problemy z wszystkich zamówień w grupie
                const groupHasIssue = row.orderEntries.some((e) => {
      const hasList = orderHasTeethList(e.item);
      const hasSpec = orderHasTeethSpec(e.item, readinessCtx);
      const hasIncomplete = orderHasIncompleteTeethSpec(e.item, readinessCtx);
      const needsHeader = teethQueueOrderNeedsHeaderData(e.item);
      return !hasSpec || hasIncomplete || !hasList || needsHeader;
    });

                const toggleGroup = () => {
      if (allUnorderedSelected) {
        // Odznacz wszystkie
        for (const entry of row.orderEntries) {
          for (const pos of entry.unorderedPositions) {
            onTogglePosition(entry.orderId, pos);
          }
        }
      } else {
        // Zaznacz tylko te nie zaznaczone
        for (const entry of row.orderEntries) {
          const sel = positionSelection.get(entry.orderId);
          for (const pos of entry.unorderedPositions) {
            if (!sel?.has(pos)) {
              onTogglePosition(entry.orderId, pos);
            }
          }
        }
      }
    };

                // Badge'e problemów per handlowiec
                const salesIssues = row.salesPersonName
      ? salesPersonIssueBadges.get(row.salesPersonName)
      : null;

                const salesIdx = salesPersonIndexMap.get(row.salesPersonName) ?? 0;
    const isEvenSales = salesIdx % 2 === 0;
    const salesAccent = isEvenSales ? "bg-slate-50/40" : "bg-white/40";
    const salesAccentHover = isEvenSales ? "hover:bg-slate-100/50" : "hover:bg-slate-50/60";
    const salesAccentBorder = isEvenSales
      ? "border-l-2 border-l-slate-300/60"
      : "border-l-2 border-l-indigo-300/50";

                const salesRowCount = salesPersonRowCounts.get(row.salesPersonName) ?? 0;

                return (
                  <Fragment key={`${row.key}-${index}`}>
                    {row.isFirstRowOfSalesPerson ? (
                      <tr>
                        <td
                          colSpan={7}
                          className={cn(
                            "border-b border-slate-200/80 bg-white/60 px-3 py-1.5 sm:px-4 lg:px-5",
                            index > 0 && "border-t border-slate-200/80",
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                "size-2 rounded-full",
                                isEvenSales ? "bg-slate-400" : "bg-indigo-400",
                              )}
                            />
                            <span className="text-xs font-semibold text-slate-800">
                              {row.salesPersonName ?? "Bez handlowca"}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {salesRowCount} {salesRowCount === 1 ? "wiersz" : salesRowCount < 5 ? "wiersze" : "wierszy"}
                            </span>
                            {salesIssues && (salesIssues.missingList || salesIssues.incomplete || salesIssues.needsHeader || salesIssues.informacja) ? (
                              <div className="flex flex-wrap items-center gap-1">
                                {salesIssues.missingList ? (
                                  <Badge key="missing" variant="warning" className="text-[10px]">
                                    Brak listy
                                  </Badge>
                                ) : null}
                                {salesIssues.incomplete ? (
                                  <Badge key="incomplete" variant="warning" className="text-[10px]">
                                    Niekompletna
                                  </Badge>
                                ) : null}
                                {salesIssues.needsHeader ? (
                                  <Badge key="header" variant="warning" className="text-[10px]">
                                    {TEETH_QUEUE_HEADER_DATA_LABEL}
                                  </Badge>
                                ) : null}
                                {salesIssues.informacja ? (
                                  <Badge key="info" variant="default" className="text-[10px]">
                                    Informacja
                                  </Badge>
                                ) : null}
                              </div>
                            ) : null}
                            {salesIssues && salesIssues.notes.length > 0 ? (
                              <ProcurementSalesRequestNote note={salesIssues.notes[0].note} compact />
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  <tr
                    className={cn(
                      "border-b border-slate-100/90 last:border-b-0 transition-colors",
                      salesAccentBorder,
                      allOrdered
                        ? "bg-slate-50/40 text-slate-400"
                        : allUnorderedSelected
                          ? cn(salesAccent, "hover:bg-slate-50")
                          : groupHasIssue
                            ? "bg-amber-50/20 hover:bg-amber-50/30"
                            : cn(salesAccent, salesAccentHover),
                    )}
                  >
                    <td className="py-1.5 pl-3 pr-1 sm:pl-4 lg:pl-5">
                      {!allOrdered && row.totalUnordered > 0 ? (
                        <input
                          type="checkbox"
                          checked={allUnorderedSelected}
                          ref={(el) => { if (el) el.indeterminate = someSelected; }}
                          onChange={toggleGroup}
                          className={cn(checkboxBrandClass, "shrink-0")}
                          aria-label={`Zaznacz: ${row.color} ${row.mould ?? ""} (${row.totalUnordered} szt.) — ${row.salesPersonName ?? ""}`}
                        />
                      ) : allOrdered ? (
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="text-emerald-500" aria-label="Zamówione">
                          <path d="M3 8l3.5 3.5L13 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      ) : null}
                    </td>
                    <td className={cn("py-1.5 px-2 font-semibold", allOrdered ? "text-slate-400" : "text-slate-900")}>
                      {noSpec ? "—" : row.color || "—"}
                    </td>
                    <td className={cn("py-1.5 px-2 font-medium", allOrdered ? "text-slate-400" : "text-slate-800")}>
                      {noSpec ? "—" : row.mould?.trim() || "—"}
                    </td>
                    <td className={cn("py-1.5 px-2", allOrdered ? "text-slate-400" : "text-slate-700")}>
                      {noSpec ? "—" : jawLabel(row.jaw, row.kind)}
                    </td>
                    <td className={cn("py-1.5 px-2", allOrdered ? "text-slate-400" : "text-slate-700")}>
                      {noSpec ? "—" : kindLabel(row.kind)}
                    </td>
                    <td className={cn("py-1.5 px-2 text-right font-semibold tabular-nums", allOrdered ? "text-slate-400" : "text-slate-800")}>
                      {noSpec ? "—" : row.totalOrdered > 0 ? (
                        <span className={cn(row.totalOrdered === row.totalCount ? "text-emerald-600" : "text-slate-500")}>
                          {row.totalOrdered}/{row.totalCount}
                        </span>
                      ) : row.totalCount}
                    </td>
                    <td className="py-1.5 pr-3 pl-2 sm:pr-4 lg:pr-5">
                      {onEditSaved ? (
                        <div className="flex flex-col gap-0.5">
                          {row.orderEntries
                            .filter((e) => {
                              if (alwaysShowEdit) return true;
                              const hasList = orderHasTeethList(e.item);
                              const hasSpec = orderHasTeethSpec(e.item, readinessCtx);
                              const hasIncomplete = orderHasIncompleteTeethSpec(e.item, readinessCtx);
                              const needsHeader = teethQueueOrderNeedsHeaderData(e.item);
                              return !hasSpec || hasIncomplete || !hasList || needsHeader;
                            })
                            .map((e) => (
                              <TeethPanelEditOrderTrigger
                                key={e.orderId}
                                orderId={e.orderId}
                                onSaved={onEditSaved}
                                className={teethPanelEditLinkClass}
                              />
                            ))}
                        </div>
                      ) : null}
                    </td>
                  </tr>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {items.some((i) => !orderHasTeethList(i)) ? (
          <div className={cn(teethPanelIncompleteShellClass, "mx-3 px-2.5 py-2 sm:mx-4 lg:mx-5")}>
            <p className={teethPanelIncompleteTitleClass}>Brak listy zębów</p>
            <p className={teethPanelIncompleteDetailClass}>
              Co najmniej jedna prośba nie ma uzupełnionej specyfikacji — uzupełnij przed zamówieniem u dostawcy.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
