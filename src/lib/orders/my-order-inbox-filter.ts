import type { MyOrderRow } from "@/lib/orders/my-order-presenter";
import { enrichMyOrderSalesUi } from "@/lib/orders/my-order-sales-ui";

export type MyOrderInboxFilter =
  | "pickup"
  | "partial"
  | "cancel_ack"
  | "informacja_ready"
  | "overdue"
  | "verification"
  | "przed_zamowieniem"
  | "zamowione"
  | "availability_pending";

export function rowMatchesInboxFilter(
  row: MyOrderRow,
  filter: MyOrderInboxFilter
): boolean {
  const ui = enrichMyOrderSalesUi(row);

  switch (filter) {
    case "pickup":
      return ui.sortPriority === 1;
    case "partial":
      return ui.sortPriority === 2;
    case "cancel_ack":
      return ui.sortPriority === 3;
    case "overdue":
      return ui.sortPriority === 4;
    case "verification":
      return ui.sortPriority === 5;
    case "informacja_ready":
      return ui.sortPriority === 10;
    case "przed_zamowieniem":
      return row.kind === "zamowienie" && row.statusTitle === "Przed zamówieniem";
    case "zamowione":
      return row.kind === "zamowienie" && row.statusTitle === "Zamówione";
    case "availability_pending":
      return (
        row.kind === "informacja" &&
        (row.statusTitle === "Oczekuje na magazyn" ||
          row.statusTitle === "Czekamy na zamówienie u dostawcy" ||
          row.statusTitle === "Zamówione — czekamy na magazyn")
      );
    default:
      return true;
  }
}

export function filterMyOrderRows(
  rows: MyOrderRow[],
  filter: MyOrderInboxFilter | null
): MyOrderRow[] {
  if (!filter) return rows;
  return rows.filter((row) => rowMatchesInboxFilter(row, filter));
}

/** Prośba wymaga potwierdzenia handlowca (odbiór, część magazynu, anulowanie, informacja gotowa). */
export function rowNeedsSalesAction(row: MyOrderRow): boolean {
  const p = enrichMyOrderSalesUi(row).sortPriority;
  return p === 1 || p === 2 || p === 3 || p === 10;
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
