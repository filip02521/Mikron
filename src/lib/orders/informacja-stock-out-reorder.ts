import { isInformacjaRequest } from "@/lib/orders/individual";
import type { IndividualOrder } from "@/types/database";

export type InformacjaFlowPath = "direct" | "via_panel" | "stock_out";

/** Sygnał dla zakupów: brak na stanie, pozycja do zamówienia u dostawcy — bez e-maila do handlowca. */
export function isInformacjaStockOutReorder(
  order: Pick<IndividualOrder, "request_kind" | "informacja_stock_out_reorder">
): boolean {
  return (
    isInformacjaRequest(order) && order.informacja_stock_out_reorder === true
  );
}

/**
 * Sygnał „brak na stanie” trafia wyłącznie do panelu Dziś (zakupy).
 * Handlowiec nie widzi wpisu w „Moje zamówienia”, archiwum ani statusów.
 */
export function isInformacjaStockOutHiddenFromSales(
  order: Pick<IndividualOrder, "request_kind" | "informacja_stock_out_reorder">
): boolean {
  return isInformacjaStockOutReorder(order);
}

export function filterIndividualOrdersForSalesMyOrders<T extends Pick<
  IndividualOrder,
  "request_kind" | "informacja_stock_out_reorder"
>>(orders: T[]): T[] {
  return orders.filter((o) => !isInformacjaStockOutHiddenFromSales(o));
}

export function informacjaFlowPathFromOrder(
  order: Pick<
    IndividualOrder,
    "request_kind" | "informacja_queue_via_daily_panel" | "informacja_stock_out_reorder"
  >
): InformacjaFlowPath | null {
  if (!isInformacjaRequest(order)) return null;
  if (isInformacjaStockOutReorder(order)) return "stock_out";
  if (order.informacja_queue_via_daily_panel === true) return "via_panel";
  return "direct";
}

export function flagsFromInformacjaFlowPath(path: InformacjaFlowPath): {
  informacjaQueueViaDailyPanel: boolean;
  informacjaStockOutReorder: boolean;
} {
  switch (path) {
    case "via_panel":
      return { informacjaQueueViaDailyPanel: true, informacjaStockOutReorder: false };
    case "stock_out":
      return { informacjaQueueViaDailyPanel: false, informacjaStockOutReorder: true };
    default:
      return { informacjaQueueViaDailyPanel: false, informacjaStockOutReorder: false };
  }
}
