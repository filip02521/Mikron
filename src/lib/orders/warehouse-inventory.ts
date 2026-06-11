import { formatPlDate } from "@/lib/display-labels";
import { calculateBusinessDays, parseDateOnly, toDateOnly } from "@/lib/orders/dates";
import { getDeliveryProgress } from "@/lib/orders/individual";
import type { IndividualOrder } from "@/types/database";

export type WarehouseInventoryKind = "pickup_full" | "pickup_partial" | "informacja_ready";

export type WarehouseWaitingLevel = "ok" | "warn" | "critical";

export type WarehouseInventoryRow = {
  order: IndividualOrder;
  kind: WarehouseInventoryKind;
  shelfLabel: string;
  waitingSince: string | null;
  waitingDays: number;
  waitingLevel: WarehouseWaitingLevel;
  quantityOnShelf: string;
  quantityLabel: string;
};

export type WarehouseInventorySummary = {
  total: number;
  uniqueSalesPeople: number;
  staleWarn: number;
  staleCritical: number;
  unassignedShelf: number;
  byShelf: { shelf: string; count: number }[];
};

/** Domyślna strefa magazynu (regał odbioru przez handlowców). */
export const WAREHOUSE_SHELF_DEFAULT = "Odbiór";

/** Pozycje bez wpisanego regału (po normalizacji i tak wyświetlane jako Odbiór). */
export const WAREHOUSE_SHELF_UNASSIGNED = "— Nie przypisano";

export function normalizeShelfLabel(raw: string | null | undefined): string {
  const s = raw?.trim();
  return s || WAREHOUSE_SHELF_DEFAULT;
}

export function isWarehouseShelfUnset(raw: string | null | undefined): boolean {
  const s = raw?.trim();
  return !s;
}

function waitingLevel(days: number): WarehouseWaitingLevel {
  if (days >= 7) return "critical";
  if (days >= 3) return "warn";
  return "ok";
}

function classifyOnShelf(order: IndividualOrder): WarehouseInventoryKind | null {
  if (order.sales_acknowledged_at || order.sales_cancelled_at) return null;

  if (order.request_kind === "informacja" && order.status === "Zrealizowane") {
    return "informacja_ready";
  }

  if (order.request_kind !== "zamowienie") return null;

  if (order.status === "Zrealizowane") return "pickup_full";

  if (order.status === "Czesciowo_zrealizowane") {
    const delivered = order.delivered_quantity?.trim();
    if (!delivered || delivered === "-") return null;
    const progress = getDeliveryProgress(order.quantity, delivered);
    if (progress.delivered > 0) return "pickup_partial";
  }

  return null;
}

export function isWarehouseInventoryOrder(order: IndividualOrder): boolean {
  return classifyOnShelf(order) !== null;
}

function waitingSinceDate(order: IndividualOrder): string | null {
  return order.delivery_at ?? order.action_at ?? null;
}

function businessDaysWaiting(since: string | null): number {
  const start = parseDateOnly(since);
  if (!start) return 0;
  const today = toDateOnly(new Date());
  return Math.max(0, calculateBusinessDays(start, today));
}

function quantityLabels(order: IndividualOrder, kind: WarehouseInventoryKind): {
  onShelf: string;
  label: string;
} {
  const delivered =
    order.delivered_quantity && order.delivered_quantity !== "-"
      ? order.delivered_quantity
      : "0";
  const ordered = order.quantity && order.quantity !== "-" ? order.quantity : "—";

  if (kind === "pickup_partial") {
    const progress = getDeliveryProgress(order.quantity, delivered);
    return {
      onShelf: delivered,
      label: progress.ordered != null ? `${delivered} z ${ordered} szt.` : `${delivered} szt.`,
    };
  }

  if (kind === "informacja_ready") {
    return { onShelf: "—", label: "Informacja — bez ilości" };
  }

  return {
    onShelf: delivered !== "0" ? delivered : ordered,
    label: ordered !== "—" ? `${ordered} szt.` : delivered,
  };
}

export function buildWarehouseInventoryRow(order: IndividualOrder): WarehouseInventoryRow | null {
  const kind = classifyOnShelf(order);
  if (!kind) return null;

  const waitingSince = waitingSinceDate(order);
  const waitingDays = businessDaysWaiting(waitingSince);
  const qty = quantityLabels(order, kind);

  return {
    order,
    kind,
    shelfLabel: normalizeShelfLabel(order.warehouse_shelf),
    waitingSince,
    waitingDays,
    waitingLevel: waitingLevel(waitingDays),
    quantityOnShelf: qty.onShelf,
    quantityLabel: qty.label,
  };
}

export function buildWarehouseInventoryRows(orders: IndividualOrder[]): WarehouseInventoryRow[] {
  return orders
    .map(buildWarehouseInventoryRow)
    .filter((r): r is WarehouseInventoryRow => r !== null)
    .sort((a, b) => {
      const shelf = a.shelfLabel.localeCompare(b.shelfLabel, "pl");
      if (shelf !== 0) return shelf;
      if (b.waitingDays !== a.waitingDays) return b.waitingDays - a.waitingDays;
      return (a.order.products ?? "").localeCompare(b.order.products ?? "", "pl");
    });
}

export function summarizeWarehouseInventory(rows: WarehouseInventoryRow[]): WarehouseInventorySummary {
  const people = new Set<string>();
  let staleWarn = 0;
  let staleCritical = 0;
  let unassignedShelf = 0;
  const shelfCounts = new Map<string, number>();

  for (const row of rows) {
    people.add(row.order.sales_person_id);
    if (row.waitingLevel === "warn") staleWarn++;
    if (row.waitingLevel === "critical") staleCritical++;
    if (isWarehouseShelfUnset(row.order.warehouse_shelf)) unassignedShelf++;
    shelfCounts.set(row.shelfLabel, (shelfCounts.get(row.shelfLabel) ?? 0) + 1);
  }

  const byShelf = [...shelfCounts.entries()]
    .map(([shelf, count]) => ({ shelf, count }))
    .sort((a, b) => {
      if (a.shelf === WAREHOUSE_SHELF_DEFAULT && b.shelf !== WAREHOUSE_SHELF_DEFAULT) return -1;
      if (b.shelf === WAREHOUSE_SHELF_DEFAULT && a.shelf !== WAREHOUSE_SHELF_DEFAULT) return 1;
      return b.count - a.count;
    });

  return {
    total: rows.length,
    uniqueSalesPeople: people.size,
    staleWarn,
    staleCritical,
    unassignedShelf,
    byShelf,
  };
}

export function kindLabel(kind: WarehouseInventoryKind): string {
  switch (kind) {
    case "pickup_full":
      return "Do odbioru";
    case "pickup_partial":
      return "Część na magazynie";
    case "informacja_ready":
      return "Informacja";
  }
}

export function waitingLabel(row: WarehouseInventoryRow): string {
  const since = row.waitingSince ? formatPlDate(row.waitingSince.slice(0, 10)) : "—";
  const days =
    row.waitingDays === 0
      ? "dziś"
      : row.waitingDays === 1
        ? "1 dzień rob."
        : `${row.waitingDays} dni rob.`;
  const partialNote =
    row.kind === "pickup_partial" ? " · od ostatniego przyjęcia" : "";
  return `${since} · ${days}${partialNote}`;
}
