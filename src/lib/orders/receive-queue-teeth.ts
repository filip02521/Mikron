import type { IndividualOrder } from "@/types/database";
import { isTeethZamowienie, partitionOrdersByProcurementLane } from "@/lib/teeth/teeth-lifecycle";
import { hasActiveSupplierFulfillment } from "@/lib/orders/sales-cancel";
import { mergeReceiveQueueOrders } from "@/lib/orders/receive-queue";
import { supplierKey, type SupplierOrderGroup } from "@/lib/orders/queue-supplier-groups";

export type TeethReceiveInboxSummary = {
  activeCount: number;
  partialCount: number;
};

/** Pozycja zębowa w kolejce przyjęcia (nie informacja). */
export function isTeethReceiveOrder(order: IndividualOrder): boolean {
  return isTeethZamowienie(order);
}

export function partitionDeliveryOrdersByTeeth(orders: IndividualOrder[]): {
  regular: IndividualOrder[];
  teeth: IndividualOrder[];
} {
  return partitionOrdersByProcurementLane(orders);
}

function isActiveReceiveOrder(order: IndividualOrder): boolean {
  if (order.warehouse_cancel_fulfilled_at) return false;
  if (order.status === "Zrealizowane") return false;
  return (
    !order.sales_cancelled_at ||
    Boolean(order.procurement_cancel_disposition) ||
    hasActiveSupplierFulfillment(order)
  );
}

export function summarizeTeethReceiveInbox(
  deliveryOrders: IndividualOrder[]
): TeethReceiveInboxSummary {
  const active = deliveryOrders.filter(
    (o) => isTeethReceiveOrder(o) && isActiveReceiveOrder(o)
  );
  return {
    activeCount: active.length,
    partialCount: active.filter((o) => o.status === "Czesciowo_zrealizowane").length,
  };
}

export function buildTeethReceiveQueue(deliveryOrders: IndividualOrder[]): IndividualOrder[] {
  const teeth = deliveryOrders.filter(isTeethReceiveOrder);
  return mergeReceiveQueueOrders(teeth, []).filter(
    (o) => o.status !== "Zrealizowane",
  );
}

/** Klucz handlowca do paska koloru w obrębie dostawcy. */
export function teethReceiveSalesPersonKey(order: IndividualOrder): string {
  if (order.sales_person_id) return `id:${order.sales_person_id}`;
  const name = order.sales_person?.name?.trim();
  if (name) return `name:${name.toLowerCase()}`;
  return `order:${order.id}`;
}

/** W obrębie dostawcy: handlowiec, potem data zamówienia. */
export function sortTeethReceiveOrders(orders: IndividualOrder[]): IndividualOrder[] {
  return [...orders].sort((a, b) => {
    const pa = a.sales_person?.name?.trim() ?? "";
    const pb = b.sales_person?.name?.trim() ?? "";
    const byPerson = pa.localeCompare(pb, "pl", { sensitivity: "base" });
    if (byPerson !== 0) return byPerson;
    return new Date(a.action_at).getTime() - new Date(b.action_at).getTime();
  });
}

/** Indeks koloru paska — kolejni handlowcy w tej samej grupie dostawcy. */
export function teethReceiveSalesPersonStripeIndex(
  orders: IndividualOrder[],
  rowIndex: number,
): number {
  const seen: string[] = [];
  for (let i = 0; i <= rowIndex; i++) {
    const key = teethReceiveSalesPersonKey(orders[i]!);
    if (!seen.includes(key)) seen.push(key);
  }
  return Math.max(0, seen.length - 1);
}

/** Grupy po dostawcy; w środku sortowanie po handlowcu (przyjęcie zębów). */
export function groupTeethReceiveQueueBySupplier(
  orders: IndividualOrder[],
): SupplierOrderGroup[] {
  const buckets = new Map<string, IndividualOrder[]>();
  for (const order of orders) {
    const key = supplierKey(order);
    const list = buckets.get(key);
    if (list) list.push(order);
    else buckets.set(key, [order]);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b, "pl", { sensitivity: "base" }))
    .map(([key, groupOrders]) => ({
      supplierKey: key,
      orders: sortTeethReceiveOrders(groupOrders),
    }));
}

export function flattenTeethReceiveQueueGroups(groups: SupplierOrderGroup[]): IndividualOrder[] {
  return groups.flatMap((g) => g.orders);
}

export const TEETH_RECEIVE_PANEL_COPY = {
  title: "Przyjęcie zębów",
  hint: "Porównaj dostawę z zamówieniem u dostawcy — wpisz co dotarło, a co nie.",
  emptyTitle: "Kolejka przyjęcia jest pusta",
  emptyDescription:
    "Tu trafiają zęby po oznaczeniu zamówienia w kolejce. Wpisz przyjętą ilość — handlowiec zobaczy to w Moje zamówienia i potwierdzi odbiór osobisty.",
} as const;
