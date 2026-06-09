"use client";

import { Fragment, useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { actionSetWarehouseShelf } from "@/app/actions/admin";
import { SectionListLabel } from "@/components/ui/SectionListLabel";
import {
  IconAlertCircle,
  IconClipboardList,
  IconClock,
  IconPackageCheck,
  IconWarehouse,
} from "@/components/icons/StrokeIcons";
import { QueueGroupExpandControl } from "@/components/queue/QueueGroupExpandControl";
import { QueueMetricTab } from "@/components/queue/QueueMetricTab";
import { EmptyState } from "@/components/ui/EmptyState";
import { DataTable, TableScroll } from "@/components/ui/DataTable";
import { Button } from "@/components/ui/Button";
import { Toast } from "@/components/ui/Toast";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { SupplierFilterChips } from "@/components/queue/SupplierFilterChips";
import { SupplierGroupHeaderRow } from "@/components/queue/SupplierGroupHeaderRow";
import { cn } from "@/lib/cn";
import {
  QUEUE_LIST_BODY_CLASS,
  queueToolbarFieldLabelClass,
  queueToolbarInputClass,
  queueToolbarShellClass,
} from "@/lib/ui/queue-panel-styles";
import { controlFocusClass, panelSectionInsetClass } from "@/lib/ui/ontime-theme";
import type { IndividualOrder } from "@/types/database";
import {
  buildWarehouseInventoryRows,
  kindLabel,
  summarizeWarehouseInventory,
  waitingLabel,
  WAREHOUSE_SHELF_DEFAULT,
  isWarehouseShelfUnset,
  type WarehouseInventoryRow,
} from "@/lib/orders/warehouse-inventory";
import {
  sortWarehouseInventoryRows,
  type WarehouseInventorySortMode,
} from "@/lib/orders/warehouse-inventory-sort";
import { partialShelfCrossLabel } from "@/lib/orders/warehouse-cross-link";
import { countOrdersBySupplier } from "@/lib/orders/supplier-filter-summary";
import { buildSupplierGroupMetrics, formatSupplierGroupHeaderSummary } from "@/lib/orders/supplier-group-metrics";
import { useSupplierGroupCollapse } from "@/lib/orders/use-supplier-group-collapse";
import {
  queueSupplierLeadingCellClass,
  queueSupplierRowClass,
  supplierKey,
  type SupplierOrderGroup,
} from "@/lib/orders/queue-supplier-groups";

type InventoryFilter = "all" | "stale" | "critical" | "unassigned";

function ShelfEditor({
  initial,
  disabled,
  onSaved,
}: {
  initial: string;
  disabled: boolean;
  onSaved: (shelf: string) => void;
}) {
  const [value, setValue] = useState(initial === WAREHOUSE_SHELF_DEFAULT ? "" : initial);
  const [editing, setEditing] = useState(false);

  const save = () => {
    if (disabled) return;
    onSaved(value);
    setEditing(false);
  };

  if (!editing) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => setEditing(true)}
        className={cn(
          "max-w-[5.5rem] truncate text-left text-xs font-semibold underline-offset-2 hover:underline",
          initial === WAREHOUSE_SHELF_DEFAULT ? "text-emerald-800" : "text-slate-800"
        )}
        title="Kliknij, aby zmienić regał"
      >
        {initial}
      </button>
    );
  }

  return (
    <div className="flex min-w-[8rem] flex-col gap-1 sm:flex-row sm:items-center">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={WAREHOUSE_SHELF_DEFAULT}
        className={cn("w-full rounded-md border border-slate-200 px-1.5 py-0.5 text-xs", controlFocusClass)}
        autoFocus
        disabled={disabled}
        onKeyDown={(e) => {
          if (e.key === "Enter") void save();
          if (e.key === "Escape") setEditing(false);
        }}
      />
      <div className="flex gap-1">
        <Button type="button" size="sm" variant="primary" disabled={disabled} onClick={() => void save()}>
          OK
        </Button>
        <Button type="button" size="sm" variant="ghost" disabled={disabled} onClick={() => setEditing(false)}>
          Anuluj
        </Button>
      </div>
    </div>
  );
}

function WaitingBadge({ row }: { row: WarehouseInventoryRow }) {
  const tone =
    row.waitingLevel === "critical"
      ? "bg-rose-100 text-rose-900"
      : row.waitingLevel === "warn"
        ? "bg-amber-100 text-amber-900"
        : "bg-slate-100 text-slate-700";
  return (
    <span className={cn("inline-block rounded px-1.5 py-0.5 text-[11px] font-medium tabular-nums", tone)}>
      {waitingLabel(row)}
    </span>
  );
}

function groupInventoryRows(
  rows: WarehouseInventoryRow[],
  groupKeyOf: (row: WarehouseInventoryRow) => string
): { supplierKey: string; rows: WarehouseInventoryRow[] }[] {
  const groups: { supplierKey: string; rows: WarehouseInventoryRow[] }[] = [];
  for (const row of rows) {
    const key = groupKeyOf(row);
    const last = groups[groups.length - 1];
    if (last?.supplierKey === key) last.rows.push(row);
    else groups.push({ supplierKey: key, rows: [row] });
  }
  return groups;
}

function salesGroupKey(row: WarehouseInventoryRow): string {
  return row.order.sales_person?.name?.trim() || "Handlowiec nieprzypisany";
}

export function WarehouseInventorySection({
  orders,
  deliveryQueueOrders = [],
}: {
  orders: IndividualOrder[];
  /** Do podsumowania w nagłówku: ile od dostawcy czeka w kolejce przyjęcia. */
  deliveryQueueOrders?: IndividualOrder[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [filter, setFilter] = useState<InventoryFilter>("all");
  const [shelfFilter, setShelfFilter] = useState<string>("");
  const [supplierFilter, setSupplierFilter] = useState("");
  const [sortMode, setSortMode] = useState<WarehouseInventorySortMode>("supplier");
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState<{ text: string; tone: "success" | "error" } | null>(null);

  const rows = useMemo(() => buildWarehouseInventoryRows(orders), [orders]);
  const supplierMetrics = useMemo(
    () => buildSupplierGroupMetrics(deliveryQueueOrders, orders),
    [deliveryQueueOrders, orders]
  );
  const summary = useMemo(() => summarizeWarehouseInventory(rows), [rows]);
  const supplierChips = useMemo(() => countOrdersBySupplier(rows.map((r) => r.order)), [rows]);

  const setInventoryFilter = useCallback((next: InventoryFilter) => {
    setFilter((prev) => (prev === next && next !== "all" ? "all" : next));
  }, []);

  useEffect(() => {
    setFilter((prev) => {
      if (prev === "stale" && summary.staleWarn + summary.staleCritical === 0) return "all";
      if (prev === "critical" && summary.staleCritical === 0) return "all";
      if (prev === "unassigned" && summary.unassignedShelf === 0) return "all";
      return prev;
    });
  }, [summary.staleWarn, summary.staleCritical, summary.unassignedShelf]);

  const sortedRows = useMemo(
    () => sortWarehouseInventoryRows(rows, sortMode),
    [rows, sortMode]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const bySupplier = supplierFilter
      ? sortedRows.filter((row) => supplierKey(row.order) === supplierFilter)
      : sortedRows;

    return bySupplier.filter((row) => {
      if (filter === "stale" && row.waitingLevel === "ok") return false;
      if (filter === "critical" && row.waitingLevel !== "critical") return false;
      if (filter === "unassigned" && !isWarehouseShelfUnset(row.order.warehouse_shelf)) {
        return false;
      }
      if (shelfFilter && row.shelfLabel !== shelfFilter) return false;
      if (!q) return true;
      const o = row.order;
      const hay = [
        o.products,
        o.symbol,
        o.sales_person?.name,
        o.sales_person?.email,
        o.sales_client_name,
        o.supplier?.name,
        row.shelfLabel,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [sortedRows, filter, shelfFilter, supplierFilter, search]);

  const inventoryGroups = useMemo(() => {
    const keyOf =
      sortMode === "supplier"
        ? (row: WarehouseInventoryRow) => supplierKey(row.order)
        : sortMode === "shelf"
          ? (row: WarehouseInventoryRow) => row.shelfLabel
          : (row: WarehouseInventoryRow) => salesGroupKey(row);
    return groupInventoryRows(filtered, keyOf);
  }, [filtered, sortMode]);

  const groupBySupplier = sortMode === "supplier";
  const tableColSpan = groupBySupplier ? 5 : 6;

  const inventoryGroupsAsSupplier = useMemo((): SupplierOrderGroup[] => {
    return inventoryGroups.map((g) => ({
      supplierKey: g.supplierKey,
      orders: g.rows.map((r) => r.order),
    }));
  }, [inventoryGroups]);

  const inventoryCollapse = useSupplierGroupCollapse(inventoryGroupsAsSupplier, supplierFilter, {
    collapseMode: "all",
  });

  const saveShelf = useCallback(
    (orderId: string, shelf: string) => {
      start(async () => {
        try {
          await actionSetWarehouseShelf(orderId, shelf);
          setToast({ text: "Zapisano lokalizację regału", tone: "success" });
          router.refresh();
        } catch (e) {
          setToast({
            text: e instanceof Error ? e.message : "Nie udało się zapisać regału",
            tone: "error",
          });
        }
      });
    },
    [router]
  );

  const shelfOptions = summary.byShelf.map((s) => s.shelf);

  const renderDataRow = (
    row: WarehouseInventoryRow,
    groupIndex: number,
    options: { showSupplierColumn: boolean }
  ) => {
    const o = row.order;
    const person = o.sales_person;
    const supplierName = supplierKey(o);
    const crossLabel = partialShelfCrossLabel(o);
    const productTitle = [
      o.products,
      o.symbol && o.symbol !== "-" ? `(${o.symbol})` : null,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <tr
        key={o.id}
        className={cn(
          queueSupplierRowClass(groupIndex, {
            variant: "informacja",
            isPartial: row.kind === "pickup_partial",
            isFirstInSupplierGroup: false,
          }),
          row.waitingLevel === "critical" && "ring-1 ring-inset ring-rose-200/80",
          row.waitingLevel === "warn" && "ring-1 ring-inset ring-amber-100"
        )}
      >
        <td
          className={cn(
            "align-top",
            queueSupplierLeadingCellClass(groupIndex, { variant: "informacja" })
          )}
        >
          <ShelfEditor
            key={`${o.id}:${row.shelfLabel}`}
            initial={row.shelfLabel}
            disabled={pending}
            onSaved={(shelf) => saveShelf(o.id, shelf)}
          />
        </td>
        {options.showSupplierColumn ? (
          <td
            className="max-w-[9rem] align-top font-semibold text-slate-900"
            title={supplierName}
          >
            <span className="line-clamp-2">{supplierName}</span>
          </td>
        ) : null}
        <td className="align-top min-w-[8rem] max-w-[14rem]">
          <p className="line-clamp-2 font-medium text-slate-900" title={productTitle}>
            {o.products}
          </p>
          {o.symbol && o.symbol !== "-" ? (
            <p className="truncate text-[11px] text-slate-500">{o.symbol}</p>
          ) : null}
          {crossLabel ? (
            <p className="mt-0.5 line-clamp-1 text-[10px] font-medium text-amber-800">{crossLabel}</p>
          ) : null}
        </td>
        <td className="align-top min-w-[6rem] max-w-[10rem]">
          <p className="truncate font-medium text-slate-900" title={person?.name ?? undefined}>
            {person?.name ?? "—"}
          </p>
          {o.sales_client_name?.trim() ? (
            <p
              className="truncate text-[11px] text-slate-600"
              title={o.sales_client_name.trim()}
            >
              {o.sales_client_name.trim()}
            </p>
          ) : null}
        </td>
        <td className="align-top whitespace-nowrap tabular-nums font-medium">{row.quantityLabel}</td>
        <td className="align-top">
          <div className="flex flex-col items-start gap-1">
            <WaitingBadge row={row} />
            <span
              className={cn(
                "inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                row.kind === "pickup_full"
                  ? "bg-emerald-100 text-emerald-900"
                  : row.kind === "pickup_partial"
                    ? "bg-amber-100 text-amber-900"
                    : "bg-sky-100 text-sky-900"
              )}
            >
              {kindLabel(row.kind)}
            </span>
          </div>
        </td>
      </tr>
    );
  };

  return (
    <section id="inwentaryzacja" className="scroll-mt-20 border-t border-slate-100">
      {toast ? <Toast message={toast.text} tone={toast.tone} onDismiss={() => setToast(null)} /> : null}

      <SectionListLabel
        domain="panel"
        title="Inwentaryzacja regału"
        hint="Co czeka na odbiór — grupy po dostawcy, regale lub handlowcu"
        count={rows.length}
        accent="emerald"
        icon={<IconClipboardList size={17} />}
        tileClassName="bg-emerald-100 text-emerald-800"
      />

      <div className={cn("space-y-2.5 border-b border-slate-100", panelSectionInsetClass)}>
        <div
          role="tablist"
          aria-label="Filtr inwentaryzacji"
          className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 sm:gap-2"
        >
          <QueueMetricTab
            active={filter === "all"}
            count={summary.total}
            label="Wszystkie"
            hint={
              supplierChips.length > 0
                ? `${supplierChips.length} ${supplierChips.length === 1 ? "dostawca" : "dostawców"}`
                : "pełna lista"
            }
            icon={<IconPackageCheck size={14} />}
            tileClassName="bg-emerald-100 text-emerald-800"
            title="Wszystkie pozycje na regale"
            onClick={() => setInventoryFilter("all")}
          />
          <QueueMetricTab
            active={filter === "stale"}
            count={summary.staleWarn + summary.staleCritical}
            label="≥ 3 dni"
            hint="czeka na odbiór"
            icon={<IconClock size={14} />}
            tileClassName="bg-amber-100 text-amber-800"
            title="Pozycje czekające co najmniej 3 dni robocze"
            onClick={() => setInventoryFilter("stale")}
            disabled={summary.staleWarn + summary.staleCritical === 0}
          />
          <QueueMetricTab
            active={filter === "critical"}
            count={summary.staleCritical}
            label="≥ 7 dni"
            hint="pilne do odbioru"
            icon={<IconAlertCircle size={14} />}
            tileClassName="bg-rose-100 text-rose-800"
            title="Pozycje czekające co najmniej 7 dni roboczych"
            onClick={() => setInventoryFilter("critical")}
            disabled={summary.staleCritical === 0}
          />
          <QueueMetricTab
            active={filter === "unassigned"}
            count={summary.unassignedShelf}
            label="Bez regału"
            hint="brak lokalizacji"
            icon={<IconWarehouse size={14} />}
            tileClassName="bg-sky-100 text-sky-800"
            title="Pozycje bez przypisanego regału"
            onClick={() => setInventoryFilter("unassigned")}
            disabled={summary.unassignedShelf === 0}
          />
        </div>

        <div className={queueToolbarShellClass}>
          <label className="min-w-0 flex-1">
            <span className={queueToolbarFieldLabelClass}>Szukaj</span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Produkt, handlowiec, klient…"
              className={cn(queueToolbarInputClass, controlFocusClass)}
            />
          </label>
          <label className="w-full sm:w-36">
            <span className={queueToolbarFieldLabelClass}>Regał</span>
            <select
              value={shelfFilter}
              onChange={(e) => setShelfFilter(e.target.value)}
              className={cn(queueToolbarInputClass, controlFocusClass)}
            >
              <option value="">Wszystkie</option>
              {shelfOptions.map((s) => (
                <option key={s} value={s}>
                  {s} ({summary.byShelf.find((x) => x.shelf === s)?.count ?? 0})
                </option>
              ))}
            </select>
          </label>
          <div className="w-full sm:w-auto sm:shrink-0">
            <span className={queueToolbarFieldLabelClass}>Grupuj</span>
            <SegmentedControl<WarehouseInventorySortMode>
              ariaLabel="Grupowanie inwentaryzacji"
              value={sortMode}
              onChange={setSortMode}
              className="w-full sm:w-auto"
              options={[
                { value: "supplier", label: "Dostawca" },
                { value: "shelf", label: "Regał" },
                { value: "sales", label: "Handlowiec" },
              ]}
            />
          </div>
        </div>

        <SupplierFilterChips
          chips={supplierChips}
          value={supplierFilter}
          onChange={setSupplierFilter}
          totalLabel="Wszyscy"
        />
      </div>

      {!filtered.length ? (
        <EmptyState
          title={rows.length ? "Brak pozycji dla filtra" : "Magazyn pusty — brak oczekujących odbiorów"}
          description={
            rows.length
              ? "Zmień filtr, dostawcę lub wyszukiwanie."
              : "Gdy przyjmiesz całość dostawy, pozycja pojawi się tutaj do czasu odbioru przez handlowca."
          }
        />
      ) : (
        <TableScroll className="px-0 pb-0">
          {inventoryGroups.length > 1 ? (
            <div className="flex justify-end border-b border-slate-100 px-4 py-1.5 sm:px-6">
              <QueueGroupExpandControl
                groupCount={inventoryGroups.length}
                allExpanded={inventoryCollapse.allExpanded}
                onExpandAll={inventoryCollapse.expandAll}
                onCollapseAll={inventoryCollapse.collapseAll}
              />
            </div>
          ) : null}
          <div className={QUEUE_LIST_BODY_CLASS}>
            <DataTable className="queue-table">
              <thead>
                <tr>
                  <th className="w-[5.5rem]">Regał</th>
                  {!groupBySupplier ? <th className="min-w-[5.5rem]">Dostawca</th> : null}
                  <th>Produkt</th>
                  <th className="min-w-[6rem]">Dla kogo</th>
                  <th className="w-14">Ilość</th>
                  <th className="min-w-[5.5rem]">Odbiór</th>
                </tr>
              </thead>
              <tbody>
              {inventoryGroups.length > 0
                ? inventoryGroups.map((group, groupIndex) => {
                    const isOpen = inventoryCollapse.isExpanded(group.supplierKey);
                    const summary = formatSupplierGroupHeaderSummary(
                      group.rows.map((r) => r.order),
                      supplierMetrics.get(group.supplierKey)
                    );
                    const supplierGroup: SupplierOrderGroup = {
                      supplierKey: group.supplierKey,
                      orders: group.rows.map((r) => r.order),
                    };

                    return (
                      <Fragment key={group.supplierKey}>
                        <SupplierGroupHeaderRow
                          colSpan={tableColSpan}
                          groupIndex={groupIndex}
                          group={supplierGroup}
                          summary={summary}
                          isOpen={isOpen}
                          onToggle={() => inventoryCollapse.toggle(group.supplierKey)}
                          variant="informacja"
                        />
                        {isOpen
                          ? group.rows.map((row) =>
                              renderDataRow(row, groupIndex, {
                                showSupplierColumn: !groupBySupplier,
                              })
                            )
                          : null}
                      </Fragment>
                    );
                  })
                : null}
              </tbody>
            </DataTable>
          </div>
        </TableScroll>
      )}
    </section>
  );
}
