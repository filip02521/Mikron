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
        row.kind === "informacja" && row.statusTitle === "Oczekuje na dostawę"
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
