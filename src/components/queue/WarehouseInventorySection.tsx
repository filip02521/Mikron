"use client";

import { Fragment, useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { actionSetWarehouseShelf } from "@/app/actions/admin";
import { SectionListLabel } from "@/components/ui/SectionListLabel";
import { IconClipboardList } from "@/components/icons/StrokeIcons";
import { EmptyState } from "@/components/ui/EmptyState";
import { DataTable, TableScroll } from "@/components/ui/DataTable";
import { Button } from "@/components/ui/Button";
import { Toast } from "@/components/ui/Toast";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { SupplierFilterChips } from "@/components/queue/SupplierFilterChips";
import { SupplierGroupHeaderRow } from "@/components/queue/SupplierGroupHeaderRow";
import { cn } from "@/lib/cn";
import { controlFocusClass, panelContactLinkClass } from "@/lib/ui/ontime-theme";
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
  supplierGroupIndexByOrderId,
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
          "max-w-[8rem] truncate text-left text-sm underline-offset-2 hover:underline",
          initial === WAREHOUSE_SHELF_DEFAULT ? "text-emerald-800" : "text-slate-800"
        )}
        title="Kliknij, aby zmienić regał"
      >
        {initial}
      </button>
    );
  }

  return (
    <div className="flex min-w-[10rem] flex-col gap-1 sm:flex-row sm:items-center">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={WAREHOUSE_SHELF_DEFAULT}
        className={cn("w-full rounded-md border border-slate-200 px-2 py-1 text-sm", controlFocusClass)}
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
    <span className={cn("inline-block rounded-md px-2 py-0.5 text-xs font-medium tabular-nums", tone)}>
      {waitingLabel(row)}
    </span>
  );
}

function groupInventoryRows(
  rows: WarehouseInventoryRow[]
): { supplierKey: string; rows: WarehouseInventoryRow[] }[] {
  const groups: { supplierKey: string; rows: WarehouseInventoryRow[] }[] = [];
  for (const row of rows) {
    const key = supplierKey(row.order);
    const last = groups[groups.length - 1];
    if (last?.supplierKey === key) last.rows.push(row);
    else groups.push({ supplierKey: key, rows: [row] });
  }
  return groups;
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
    if (sortMode !== "supplier") return null;
    return groupInventoryRows(filtered);
  }, [filtered, sortMode]);

  const inventoryGroupsAsSupplier = useMemo((): SupplierOrderGroup[] => {
    if (!inventoryGroups) return [];
    return inventoryGroups.map((g) => ({
      supplierKey: g.supplierKey,
      orders: g.rows.map((r) => r.order),
    }));
  }, [inventoryGroups]);

  const inventoryCollapse = useSupplierGroupCollapse(
    sortMode === "supplier" ? inventoryGroupsAsSupplier : [],
    supplierFilter
  );

  const flatGroupIndex = useMemo(
    () => supplierGroupIndexByOrderId(filtered.map((r) => r.order)),
    [filtered]
  );

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
        <td
          className={cn(
            "max-w-[9rem] align-top",
            options.showSupplierColumn ? "font-semibold text-slate-900" : "text-slate-400"
          )}
          title={supplierName}
        >
          {options.showSupplierColumn ? (
            <span className="line-clamp-2">{supplierName}</span>
          ) : (
            "—"
          )}
        </td>
        <td className="align-top">
          <p className="font-medium text-slate-900" title={productTitle}>
            {o.products}
          </p>
          {o.symbol && o.symbol !== "-" ? (
            <p className="text-xs text-slate-500">{o.symbol}</p>
          ) : null}
          {crossLabel ? (
            <p className="mt-1 text-[11px] font-medium text-amber-800">{crossLabel}</p>
          ) : null}
        </td>
        <td className="align-top">
          <p className="font-medium text-slate-900">{person?.name ?? "—"}</p>
          {person?.email ? (
            <a href={`mailto:${person.email}`} className={panelContactLinkClass}>
              {person.email}
            </a>
          ) : null}
        </td>
        <td className="align-top text-slate-700">{o.sales_client_name?.trim() || "—"}</td>
        <td className="align-top tabular-nums font-medium">{row.quantityLabel}</td>
        <td className="align-top">
          <WaitingBadge row={row} />
        </td>
        <td className="align-top">
          <span
            className={cn(
              "inline-block rounded-md px-2 py-0.5 text-xs font-medium",
              row.kind === "pickup_full"
                ? "bg-emerald-100 text-emerald-900"
                : row.kind === "pickup_partial"
                  ? "bg-amber-100 text-amber-900"
                  : "bg-sky-100 text-sky-900"
            )}
          >
            {kindLabel(row.kind)}
          </span>
        </td>
      </tr>
    );
  };

  return (
    <section id="inwentaryzacja" className="scroll-mt-20 border-t border-slate-100">
      {toast ? <Toast message={toast.text} tone={toast.tone} onDismiss={() => setToast(null)} /> : null}

      <SectionListLabel
        title="Inwentaryzacja regału"
        hint="Co leży na magazynie — pogrupowane po dostawcy, regale lub handlowcu"
        count={rows.length}
        icon={<IconClipboardList size={17} />}
        tileClassName="bg-sky-100 text-sky-800"
      />

      <div className="space-y-4 border-b border-slate-100 px-4 py-4 sm:px-6">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-[var(--shadow-card)]">
            <p className="text-2xl font-semibold tabular-nums text-slate-900">{summary.total}</p>
            <p className="text-xs font-medium text-slate-700">Pozycji na magazynie</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-[var(--shadow-card)]">
            <p className="text-2xl font-semibold tabular-nums text-slate-900">
              {supplierChips.length}
            </p>
            <p className="text-xs font-medium text-slate-700">Dostawców na regale</p>
          </div>
          <button
            type="button"
            onClick={() =>
              setFilter(filter === "stale" || filter === "critical" ? "all" : "stale")
            }
            className={cn(
              "rounded-xl border px-3 py-2.5 text-left shadow-[var(--shadow-card)] transition",
              filter === "stale" || filter === "critical"
                ? "border-amber-300 bg-amber-50/80"
                : "border-amber-200/90 bg-amber-50/60 hover:border-amber-300"
            )}
          >
            <p className="text-2xl font-semibold tabular-nums text-amber-900">
              {summary.staleWarn + summary.staleCritical}
            </p>
            <p className="text-xs font-medium text-amber-800">≥ 3 dni rob. bez odbioru</p>
          </button>
          <button
            type="button"
            onClick={() => setFilter(filter === "unassigned" ? "all" : "unassigned")}
            className={cn(
              "rounded-xl border px-3 py-2.5 text-left shadow-[var(--shadow-card)] transition",
              filter === "unassigned"
                ? "border-sky-300 bg-sky-50/80"
                : "border-sky-200/90 bg-sky-50/50 hover:border-sky-300"
            )}
          >
            <p className="text-2xl font-semibold tabular-nums text-sky-900">{summary.unassignedShelf}</p>
            <p className="text-xs font-medium text-sky-800">Bez wpisanego regału (pokaże Odbiór)</p>
          </button>
        </div>

        <SupplierFilterChips
          chips={supplierChips}
          value={supplierFilter}
          onChange={setSupplierFilter}
          totalLabel="Wszyscy"
        />
        {sortMode === "supplier" && (inventoryGroups?.length ?? 0) > 1 ? (
          <div className="flex justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() =>
                inventoryCollapse.allExpanded
                  ? inventoryCollapse.collapseAll()
                  : inventoryCollapse.expandAll()
              }
            >
              {inventoryCollapse.allExpanded ? "Zwiń dostawców" : "Rozwiń dostawców"}
            </Button>
          </div>
        ) : null}

        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <label className="min-w-0 flex-1 sm:min-w-[12rem]">
              <span className="mb-1 block text-xs font-medium text-slate-600">Szukaj</span>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Dostawca, produkt, symbol, handlowiec…"
                className={cn(
                  "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm",
                  controlFocusClass
                )}
              />
            </label>
            <label className="w-full sm:w-44">
              <span className="mb-1 block text-xs font-medium text-slate-600">Regał</span>
              <select
                value={shelfFilter}
                onChange={(e) => setShelfFilter(e.target.value)}
                className={cn(
                  "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm",
                  controlFocusClass
                )}
              >
                <option value="">Wszystkie regały</option>
                {shelfOptions.map((s) => (
                  <option key={s} value={s}>
                    {s} ({summary.byShelf.find((x) => x.shelf === s)?.count ?? 0})
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div>
            <span className="mb-1 block text-xs font-medium text-slate-600">Sortuj</span>
            <SegmentedControl<WarehouseInventorySortMode>
              ariaLabel="Sortowanie inwentaryzacji"
              value={sortMode}
              onChange={setSortMode}
              options={[
                { value: "supplier", label: "Dostawca" },
                { value: "shelf", label: "Regał" },
                { value: "sales", label: "Handlowiec" },
              ]}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {(
            [
              ["all", "Wszystkie"],
              ["stale", "Długo czeka (≥3 dni)"],
              ["critical", "Krytyczne (≥7 dni)"],
              ["unassigned", "Bez regału"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              className={cn(
                "rounded-lg border px-2.5 py-1.5 text-xs font-medium transition",
                filter === id
                  ? "border-sky-300 bg-sky-100 text-sky-900"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <p className="text-[11px] leading-relaxed text-slate-500">
          Całość przyjęta, <strong>część na magazynie</strong> lub <strong>informacja</strong> do
          potwierdzenia. Przy częściowych dostawach badge pokazuje, ile sztuk nadal czeka u dostawcy.
          Sortowanie <strong>dostawca</strong> grupuje wizualnie jak w kolejce przyjęcia.
        </p>
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
          <DataTable className="queue-table text-sm">
            <thead>
              <tr>
                <th>Regał</th>
                <th className="min-w-[6.5rem]">Dostawca</th>
                <th className="min-w-[10rem]">Produkt</th>
                <th>Handlowiec</th>
                <th>Klient</th>
                <th>Ilość</th>
                <th>Czeka na odbiór</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {sortMode === "supplier" && inventoryGroups
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
                          colSpan={8}
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
                                showSupplierColumn: false,
                              })
                            )
                          : null}
                      </Fragment>
                    );
                  })
                : filtered.map((row, index) => {
                    const prevSupplier =
                      index > 0 ? supplierKey(filtered[index - 1]!.order) : null;
                    const showSupplier = supplierKey(row.order) !== prevSupplier;
                    return renderDataRow(row, flatGroupIndex.get(row.order.id) ?? 0, {
                      showSupplierColumn: showSupplier,
                    });
                  })}
            </tbody>
          </DataTable>
        </TableScroll>
      )}
    </section>
  );
}
