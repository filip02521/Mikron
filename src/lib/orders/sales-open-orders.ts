import { presentMyOrders } from "@/lib/orders/my-order-presenter";
import { isInformacjaStockOutHiddenFromSales } from "@/lib/orders/informacja-stock-out-reorder";
import type { DeliveryStats, IndividualOrder } from "@/types/database";

/**
 * Prośba widoczna dla handlowca (jak w „Moje zamówienia”) — liczy się przy „Twoich dostawcach”.
 */
export function isOpenSalesSupplierOrder(order: IndividualOrder): boolean {
  if (isInformacjaStockOutHiddenFromSales(order)) return false;
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

/**
 * Lista dostawców na /plan — ta sama widoczność co karty w „Moje zamówienia”,
 * bez samych anulowań oczekujących na potwierdzenie ukrycia.
 */
export function aggregateVisibleMyOrdersBySupplier(
  orders: IndividualOrder[],
  stats: DeliveryStats[]
): {
  prioritySupplierIds: string[];
  openOrderCountBySupplier: Record<string, number>;
} {
  const { zamowienia, informacje } = presentMyOrders(orders, stats);
  const rows = [...zamowienia, ...informacje].filter(
    (row) => row.acknowledgeMode !== "cancelled"
  );
  const openOrderCountBySupplier: Record<string, number> = {};
  const seen = new Set<string>();

  for (const row of rows) {
    const supplierId = row.supplierId;
    if (!supplierId) continue;
    seen.add(supplierId);
    openOrderCountBySupplier[supplierId] =
      (openOrderCountBySupplier[supplierId] ?? 0) + row.lineCount;
  }

  return {
    prioritySupplierIds: [...seen],
    openOrderCountBySupplier,
  };
}
