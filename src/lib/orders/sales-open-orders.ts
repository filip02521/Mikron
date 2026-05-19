import type { IndividualOrder } from "@/types/database";

/**
 * Prośba widoczna dla handlowca (jak w „Moje zamówienia”) — liczy się przy „Twoich dostawcach”.
 */
export function isOpenSalesSupplierOrder(order: IndividualOrder): boolean {
  if (!order.supplier_id) return false;
  if (order.sales_acknowledged_at) return false;
  if (order.status === "Anulowane") return false;
  return true;
}

export function aggregateOpenOrdersBySupplier(orders: IndividualOrder[]): {
  prioritySupplierIds: string[];
  openOrderCountBySupplier: Record<string, number>;
} {
  const openOrderCountBySupplier: Record<string, number> = {};
  const seen = new Set<string>();

  for (const order of orders) {
    if (!isOpenSalesSupplierOrder(order)) continue;
    const supplierId = order.supplier_id!;
    seen.add(supplierId);
    openOrderCountBySupplier[supplierId] =
      (openOrderCountBySupplier[supplierId] ?? 0) + 1;
  }

  return {
    prioritySupplierIds: [...seen],
    openOrderCountBySupplier,
  };
}
