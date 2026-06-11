import type { MyOrderRow } from "@/lib/orders/my-order-presenter";
import { enrichMyOrderSalesUi } from "@/lib/orders/my-order-sales-ui";

/** Prośba wymaga potwierdzenia handlowca (odbiór, anulowanie, informacja gotowa). */
export function rowNeedsSalesAction(row: MyOrderRow): boolean {
  const p = enrichMyOrderSalesUi(row).sortPriority;
  return p === 1 || p === 3 || p === 10;
}

export function partitionMyOrderRowsBySalesAction(rows: MyOrderRow[]): {
  needsAction: MyOrderRow[];
  inProgress: MyOrderRow[];
} {
  const needsAction: MyOrderRow[] = [];
  const inProgress: MyOrderRow[] = [];
  for (const row of rows) {
    if (rowNeedsSalesAction(row)) needsAction.push(row);
    else inProgress.push(row);
  }
  return { needsAction, inProgress };
}
