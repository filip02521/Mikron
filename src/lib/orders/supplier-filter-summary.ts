import type { IndividualOrder } from "@/types/database";
import { supplierKey } from "@/lib/orders/queue-supplier-groups";

export type SupplierCountChip = {
  key: string;
  count: number;
};

/** Liczba pozycji per dostawca — do filtrów (chipy nad tabelą). */
export function countOrdersBySupplier(orders: IndividualOrder[]): SupplierCountChip[] {
  const map = new Map<string, number>();
  for (const o of orders) {
    const key = supplierKey(o);
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key, "pl"));
}

export function filterOrdersBySupplier(
  orders: IndividualOrder[],
  supplierFilter: string
): IndividualOrder[] {
  if (!supplierFilter) return orders;
  return orders.filter((o) => supplierKey(o) === supplierFilter);
}
