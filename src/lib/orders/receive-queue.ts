import type { IndividualOrder } from "@/types/database";
import { isInformacjaRequest } from "@/lib/orders/individual";
import { hasActiveSupplierFulfillment } from "@/lib/orders/sales-cancel";
import { supplierKey, type SupplierOrderGroup } from "@/lib/orders/queue-supplier-groups";
import type { SupplierGroupMetrics } from "@/lib/orders/supplier-group-metrics";

function productSortKey(order: IndividualOrder): string {
  const symbol = order.symbol?.trim();
  if (symbol && symbol !== "-") return symbol.toLowerCase();
  return (order.products || "").trim().toLowerCase();
}

/** W obrębie dostawcy: ten sam towar razem, zamówienia przed informacją, potem handlowiec. */
export function sortSupplierReceiveOrders(orders: IndividualOrder[]): IndividualOrder[] {
  return [...orders].sort((a, b) => {
    const byProduct = productSortKey(a).localeCompare(productSortKey(b), "pl");
    if (byProduct !== 0) return byProduct;

    const aInfo = isInformacjaRequest(a);
    const bInfo = isInformacjaRequest(b);
    if (aInfo !== bInfo) return aInfo ? 1 : -1;

    const pa = a.sales_person?.name?.trim() ?? "";
    const pb = b.sales_person?.name?.trim() ?? "";
    const byPerson = pa.localeCompare(pb, "pl", { sensitivity: "base" });
    if (byPerson !== 0) return byPerson;

    return new Date(a.action_at).getTime() - new Date(b.action_at).getTime();
  });
}

/**
 * Jedna grupa na dostawcę (nie tylko sąsiednie wiersze).
 * Po mergeReceiveQueueOrders lista dostaw i informacji bywa rozdzielona — bez tego powstają duplikaty nagłówków.
 */
export function groupReceiveQueueBySupplier(
  orders: IndividualOrder[]
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
      orders: sortSupplierReceiveOrders(groupOrders),
    }));
}

/** Jedna kolejka przyjęcia: dostawy + informacje, grupy po dostawcy. */
export function sortReceiveQueueForDisplay(orders: IndividualOrder[]): IndividualOrder[] {
  return groupReceiveQueueBySupplier(orders).flatMap((g) => g.orders);
}

export function mergeReceiveQueueOrders(
  deliveryOrders: IndividualOrder[],
  informacjaOrders: IndividualOrder[]
): IndividualOrder[] {
  const delivery = deliveryOrders.filter((o) => {
    if (o.warehouse_cancel_fulfilled_at) return false;
    return (
      !o.sales_cancelled_at ||
      o.procurement_cancel_disposition ||
      hasActiveSupplierFulfillment(o)
    );
  });
  return sortReceiveQueueForDisplay([...delivery, ...informacjaOrders]);
}

export function partitionReceiveSelection(orders: IndividualOrder[], selectedIds: string[]) {
  const idSet = new Set(selectedIds);
  const selected = orders.filter((o) => idSet.has(o.id));
  return {
    zamowienie: selected.filter((o) => !isInformacjaRequest(o)),
    informacja: selected.filter(isInformacjaRequest),
  };
}

export function formatReceiveGroupHeaderSummary(
  groupOrders: IndividualOrder[],
  globalMetrics?: SupplierGroupMetrics
): string {
  const zamowienieCount = groupOrders.filter((o) => !isInformacjaRequest(o)).length;
  const informacjaCount = groupOrders.filter(isInformacjaRequest).length;
  const parts: string[] = [`${groupOrders.length} poz.`];
  if (zamowienieCount > 0) {
    parts.push(`${zamowienieCount} ${zamowienieCount === 1 ? "zamówienie" : "zamówienia"}`);
  }
  if (informacjaCount > 0) {
    parts.push(`${informacjaCount} ${informacjaCount === 1 ? "informacja" : "informacje"}`);
  }
  const partialInGroup = groupOrders.filter(
    (o) => !isInformacjaRequest(o) && o.status === "Czesciowo_zrealizowane"
  ).length;
  if (partialInGroup > 0) parts.push(`${partialInGroup} częściowo`);
  if (globalMetrics?.shelf) parts.push(`${globalMetrics.shelf} na regale`);
  return parts.join(" · ");
}
