import type { WarehouseInventoryRow } from "@/lib/orders/warehouse-inventory";
import { supplierKey } from "@/lib/orders/queue-supplier-groups";

export type WarehouseInventorySortMode = "shelf" | "supplier" | "sales";

function salesName(row: WarehouseInventoryRow): string {
  return row.order.sales_person?.name?.trim() || "—";
}

/** Sortowanie wierszy inwentaryzacji (po zbudowaniu WarehouseInventoryRow). */
export function sortWarehouseInventoryRows(
  rows: WarehouseInventoryRow[],
  mode: WarehouseInventorySortMode
): WarehouseInventoryRow[] {
  const copy = [...rows];
  copy.sort((a, b) => {
    if (mode === "supplier") {
      const sup = supplierKey(a.order).localeCompare(supplierKey(b.order), "pl");
      if (sup !== 0) return sup;
      const shelf = a.shelfLabel.localeCompare(b.shelfLabel, "pl");
      if (shelf !== 0) return shelf;
      if (b.waitingDays !== a.waitingDays) return b.waitingDays - a.waitingDays;
      return (a.order.products ?? "").localeCompare(b.order.products ?? "", "pl");
    }
    if (mode === "sales") {
      const sales = salesName(a).localeCompare(salesName(b), "pl");
      if (sales !== 0) return sales;
      const sup = supplierKey(a.order).localeCompare(supplierKey(b.order), "pl");
      if (sup !== 0) return sup;
      if (b.waitingDays !== a.waitingDays) return b.waitingDays - a.waitingDays;
      return (a.order.products ?? "").localeCompare(b.order.products ?? "", "pl");
    }
    const shelf = a.shelfLabel.localeCompare(b.shelfLabel, "pl");
    if (shelf !== 0) return shelf;
    const sup = supplierKey(a.order).localeCompare(supplierKey(b.order), "pl");
    if (sup !== 0) return sup;
    if (b.waitingDays !== a.waitingDays) return b.waitingDays - a.waitingDays;
    return (a.order.products ?? "").localeCompare(b.order.products ?? "", "pl");
  });
  return copy;
}
