import type { MyOrderRow } from "@/lib/orders/my-order-presenter";
import { enrichMyOrderSalesUi } from "@/lib/orders/my-order-sales-ui";

export type MyOrderInboxFilter =
  | "action_group"
  | "watch_group"
  | "pickup"
  | "partial"
  | "cancel_ack"
  | "informacja_ready"
  | "overdue"
  | "verification"
  | "przed_zamowieniem"
  | "zamowione"
  | "availability_pending";

export const MOJE_INBOX_ACTION_FILTERS = [
  "pickup",
  "partial",
  "cancel_ack",
  "informacja_ready",
] as const satisfies readonly MyOrderInboxFilter[];

export const MOJE_INBOX_WATCH_FILTERS = [
  "overdue",
  "verification",
  "przed_zamowieniem",
  "zamowione",
  "availability_pending",
] as const satisfies readonly MyOrderInboxFilter[];

export type MyOrderInboxSubFilter =
  | (typeof MOJE_INBOX_ACTION_FILTERS)[number]
  | (typeof MOJE_INBOX_WATCH_FILTERS)[number];

export function isMyOrderInboxSubFilter(
  filter: MyOrderInboxFilter
): filter is MyOrderInboxSubFilter {
  return filter !== "action_group" && filter !== "watch_group";
}

export function inboxFilterGroup(
  filter: MyOrderInboxFilter | null
): "action" | "watch" | null {
  if (!filter) return null;
  if (filter === "action_group" || MOJE_INBOX_ACTION_FILTERS.includes(filter as never)) {
    return "action";
  }
  return "watch";
}

export function inboxFilterLabel(filter: MyOrderInboxFilter): string {
  switch (filter) {
    case "action_group":
      return "Wymaga reakcji";
    case "watch_group":
      return "W toku";
    case "pickup":
      return "Odbiór";
    case "partial":
      return "Część na magazynie";
    case "cancel_ack":
      return "Anulowanie";
    case "informacja_ready":
      return "Do potwierdzenia";
    case "overdue":
      return "Po terminie";
    case "verification":
      return "Sprawdzamy dane";
    case "przed_zamowieniem":
      return "Czeka na zamówienie";
    case "zamowione":
      return "Zamówione";
    case "availability_pending":
      return "Czeka na magazyn";
    default:
      return filter;
  }
}

function rowMatchesWatchSubFilter(row: MyOrderRow): boolean {
  return MOJE_INBOX_WATCH_FILTERS.some((filter) => rowMatchesInboxFilter(row, filter));
}

export function rowMatchesInboxFilter(
  row: MyOrderRow,
  filter: MyOrderInboxFilter
): boolean {
  if (filter === "action_group") return rowNeedsSalesAction(row);
  if (filter === "watch_group") return rowMatchesWatchSubFilter(row);

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
