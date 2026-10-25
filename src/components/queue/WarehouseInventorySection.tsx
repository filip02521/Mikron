"use client";
import { ToastNotice, WAREHOUSE_TOAST, toastFromUnknown } from "@/lib/ui/notice-copy";

import { Fragment, useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { actionSetWarehouseShelf, actionClearFromShelf, actionRevertToPending } from "@/app/actions/admin";
import { usePreviewMutationBlocker } from "@/components/layout/usePreviewMutationBlocker";
import { Card, CardHeader } from "@/components/ui/Card";
import { IconX, IconUndoLeft } from "@/components/icons/StrokeIcons";
import { polishPluralWord } from "@/lib/email/polish-plural";
import { QueueGroupExpandControl } from "@/components/queue/QueueGroupExpandControl";
import { EmptyState } from "@/components/ui/EmptyState";
import { DataTable, TableScroll } from "@/components/ui/DataTable";
import { Button } from "@/components/ui/Button";
import { NoticeToast } from "@/components/ui/NoticeToast";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { SupplierFilterChips } from "@/components/queue/SupplierFilterChips";
import { SupplierGroupHeaderRow } from "@/components/queue/SupplierGroupHeaderRow";
import { cn } from "@/lib/cn";
import {
  QUEUE_LIST_BODY_CLASS,
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
  queueSupplierRowClass,
  supplierKey,
  type SupplierOrderGroup,
} from "@/lib/orders/queue-supplier-groups";
import { matchesSearchWords } from "@/lib/search/keywords";

type InventoryFilter = "all" | "stale" | "critical" | "expired" | "unassigned";

const INVENTORY_FILTERS: { value: InventoryFilter; label: string; title: string }[] = [
  { value: "all", label: "Wszystkie", title: "Wszystkie pozycje na regale" },
  { value: "stale", label: "≥ 3 dni", title: "Pozycje czekające co najmniej 3 dni robocze" },
  { value: "critical", label: "≥ 7 dni", title: "Pozycje czekające co najmniej 7 dni roboczych" },
  {
    value: "expired",
    label: "≥ 21 dni",
    title: "Pozycje czekające co najmniej 21 dni roboczych - zaraz automatycznie potwierdzone",
  },
  { value: "unassigned", label: "Bez regału", title: "Pozycje bez przypisanego regału" },
];

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
    row.waitingLevel === "expired"
      ? "bg-purple-100 text-purple-900"
      : row.waitingLevel === "critical"
        ? "bg-rose-100 text-rose-900"
        : row.waitingLevel === "warn"
          ? "bg-amber-100 text-amber-900"
          : "bg-slate-100 text-slate-700";
  return (
    <span className={cn("inline-block rounded px-1.5 py-0.5 text-[0.6875rem] font-medium tabular-nums", tone)}>
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
  canClearFromShelf = false,
}: {
  orders: IndividualOrder[];
  /** Do podsumowania w nagłówku: ile od dostawcy czeka w kolejce przyjęcia. */
  deliveryQueueOrders?: IndividualOrder[];
  /** Czy bieżący użytkownik może zdjąć pozycję z regału (magazyn/admin). */
  canClearFromShelf?: boolean;
}) {
  const router = useRouter();
  const [toast, setToast] = useState<ToastNotice | null>(null);
  const { blockIfReadOnly } = usePreviewMutationBlocker((text) =>
    setToast({ text, tone: "error" })
  );
  const [pending, start] = useTransition();
  const [filter, setFilter] = useState<InventoryFilter>("all");
  const [shelfFilter, setShelfFilter] = useState<string>("");
  const [supplierFilter, setSupplierFilter] = useState("");
  const [sortMode, setSortMode] = useState<WarehouseInventorySortMode>("supplier");
  const [search, setSearch] = useState("");
  const [clearConfirmId, setClearConfirmId] = useState<string | null>(null);
  const [clearPending, startClear] = useTransition();
  const [revertConfirmId, setRevertConfirmId] = useState<string | null>(null);
  const [revertPending, startRevert] = useTransition();

  const rows = useMemo(() => buildWarehouseInventoryRows(orders), [orders]);
  const supplierMetrics = useMemo(
    () => buildSupplierGroupMetrics(deliveryQueueOrders, orders),
    [deliveryQueueOrders, orders]
  );
  const summary = useMemo(() => summarizeWarehouseInventory(rows), [rows]);
  const filterCounts: Record<InventoryFilter, number> = {
    all: summary.total,
    stale: summary.staleWarn + summary.staleCritical + summary.staleExpired,
    critical: summary.staleCritical,
    expired: summary.staleExpired,
    unassigned: summary.unassignedShelf,
  };
  const supplierChips = useMemo(() => countOrdersBySupplier(rows.map((r) => r.order)), [rows]);


  const summaryKey = `${summary.staleWarn}:${summary.staleCritical}:${summary.staleExpired}:${summary.unassignedShelf}`;
  const [appliedSummaryKey, setAppliedSummaryKey] = useState(summaryKey);
  if (summaryKey !== appliedSummaryKey) {
    setAppliedSummaryKey(summaryKey);
    setFilter((prev) => {
      if (prev === "stale" && summary.staleWarn + summary.staleCritical + summary.staleExpired === 0) return "all";
      if (prev === "critical" && summary.staleCritical === 0) return "all";
      if (prev === "expired" && summary.staleExpired === 0) return "all";
      if (prev === "unassigned" && summary.unassignedShelf === 0) return "all";
      return prev;
    });
  }

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
      if (filter === "expired" && row.waitingLevel !== "expired") return false;
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
      return matchesSearchWords(hay, q);
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
  const tableColSpan = groupBySupplier ? 6 : 7;

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
      if (blockIfReadOnly()) return;
      start(async () => {
        try {
          await actionSetWarehouseShelf(orderId, shelf);
          setToast(WAREHOUSE_TOAST.savedShelfLocation);
          router.refresh();
        } catch (e) {
          setToast(toastFromUnknown(e, "Nie udało się zapisać regału"));
        }
      });
    },
    [blockIfReadOnly, router]
  );

  const clearFromShelf = useCallback(
    (orderId: string) => {
      if (blockIfReadOnly()) return;
      startClear(async () => {
        try {
          await actionClearFromShelf([orderId]);
          setToast({ text: "Pozycja zdjęta z regału", tone: "success" });
          setClearConfirmId(null);
          router.refresh();
        } catch (e) {
          setToast(toastFromUnknown(e, "Nie udało się zdjąć z regału"));
        }
      });
    },
    [blockIfReadOnly, router]
  );

  const revertToPending = useCallback(
    (orderId: string) => {
      if (blockIfReadOnly()) return;
      startRevert(async () => {
        try {
          const result = await actionRevertToPending([orderId]);
          if (result.count > 0) {
            setToast({ text: "Przyjęcie cofnięte - pozycja wróciła do kolejki oczekujących", tone: "success" });
          } else if (result.errors.length > 0) {
            setToast({ text: result.errors[0], tone: "error" });
          }
          setRevertConfirmId(null);
          router.refresh();
        } catch (e) {
          setToast(toastFromUnknown(e, "Nie udało się cofnąć przyjęcia"));
        }
      });
    },
    [blockIfReadOnly, router]
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
          (row.waitingLevel === "expired" || row.waitingLevel === "critical") && "bg-red-50/60",
          row.waitingLevel === "warn" && "bg-amber-50/60"
        )}
      >
        <td className="align-top">
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
            <p className="truncate text-[0.6875rem] text-slate-500">{o.symbol}</p>
          ) : null}
          {crossLabel ? (
            <p className="mt-0.5 line-clamp-1 text-[0.625rem] font-medium text-amber-800">{crossLabel}</p>
          ) : null}
        </td>
        <td className="align-top min-w-[6rem] max-w-[10rem]">
          <p className="truncate font-medium text-slate-900" title={person?.name ?? undefined}>
            {person?.name ?? "-"}
          </p>
          {o.sales_client_name?.trim() ? (
            <p
              className="truncate text-[0.6875rem] text-slate-600"
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
                "inline-block rounded px-1.5 py-0.5 text-[0.625rem] font-semibold",
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
        <td className="align-top">
          {canClearFromShelf ? (
            <div className="flex flex-col gap-1">
              <button
                type="button"
                disabled={pending || clearPending || revertPending}
                onClick={() => setRevertConfirmId(o.id)}
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[0.6875rem] font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-40"
                title="Cofnij przyjęcie - wróci do kolejki oczekujących"
              >
                <IconUndoLeft size={13} />
                <span className="hidden sm:inline">Cofnij</span>
              </button>
              <button
                type="button"
                disabled={pending || clearPending || revertPending}
                onClick={() => setClearConfirmId(o.id)}
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[0.6875rem] font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-40"
                title="Zdejmij z regału"
              >
                <IconX size={13} />
                <span className="hidden sm:inline">Zdejmij</span>
              </button>
            </div>
          ) : null}
        </td>
      </tr>
    );
  };

  return (
    <Card padding={false} className="overflow-hidden">
    <section id="inwentaryzacja" className="scroll-mt-20">
      {toast ? <NoticeToast notice={toast} onDismiss={() => setToast(null)} /> : null}

      <CardHeader
        inset
        density="compact"
        title="Inwentaryzacja regału"
        description="Co czeka na odbiór, w grupach po dostawcy, regale lub handlowcu."
      />

      <div className={cn("space-y-3 border-b border-slate-100", panelSectionInsetClass)}>
        <SegmentedControl<InventoryFilter>
          ariaLabel="Filtr inwentaryzacji"
          value={filter}
          onChange={setFilter}
          options={INVENTORY_FILTERS.map((f) => ({
            value: f.value,
            title: f.title,
            label: (
              <>
                {f.label}{" "}
                <span className="tabular-nums text-slate-500">{filterCounts[f.value]}</span>
              </>
            ),
          }))}
        />

        <div className={queueToolbarShellClass}>
          <label className="min-w-0 flex-1 sm:max-w-xs">
            <span className="sr-only">Szukaj na regale</span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Produkt, handlowiec, klient…"
              className={cn(queueToolbarInputClass, controlFocusClass)}
            />
          </label>
          <select
            aria-label="Regał"
            value={shelfFilter}
            onChange={(e) => setShelfFilter(e.target.value)}
            className={cn(queueToolbarInputClass, controlFocusClass, "sm:w-40")}
          >
            <option value="">Wszystkie regały</option>
            {shelfOptions.map((s) => (
              <option key={s} value={s}>
                {s} ({summary.byShelf.find((x) => x.shelf === s)?.count ?? 0})
              </option>
            ))}
          </select>
          <SegmentedControl<WarehouseInventorySortMode>
            ariaLabel="Grupuj według"
            value={sortMode}
            onChange={setSortMode}
            options={[
              { value: "supplier", label: "Dostawca" },
              { value: "shelf", label: "Regał" },
              { value: "sales", label: "Handlowiec" },
            ]}
          />
          <p className="text-[0.6875rem] tabular-nums text-slate-500 sm:ml-auto" aria-live="polite">
            {filtered.length} {polishPluralWord(filtered.length, "pozycja", "pozycje", "pozycji")}
          </p>
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
          title={rows.length ? "Brak pozycji dla filtra" : "Magazyn pusty - brak oczekujących odbiorów"}
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
                  <th className="w-16">Akcja</th>
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
      <ConfirmDialog
        open={clearConfirmId !== null}
        title="Zdjąć z regału?"
        message="Pozycja zniknie z inwentaryzacji i z listy handlowca. Handlowiec nie dostanie powiadomienia."
        confirmLabel="Zdejmij z regału"
        danger
        pending={clearPending}
        onCancel={() => setClearConfirmId(null)}
        onConfirm={() => {
          if (clearConfirmId) clearFromShelf(clearConfirmId);
        }}
      />
      <ConfirmDialog
        open={revertConfirmId !== null}
        title="Cofnąć przyjęcie towaru?"
        message="Pozycja wróci do kolejki przyjęć jako oczekująca. Ilość dostarczona, data przyjęcia, regał i potwierdzenie handlowca zostaną wyczyszczone. Powiadomienie e-mail zostanie anulowane."
        confirmLabel="Cofnij przyjęcie"
        danger
        pending={revertPending}
        onCancel={() => setRevertConfirmId(null)}
        onConfirm={() => {
          if (revertConfirmId) revertToPending(revertConfirmId);
        }}
      />
    </section>
    </Card>
  );
}
