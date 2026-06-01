import type { IndividualOrder } from "@/types/database";
import { isInformacjaQueueViaDailyPanel } from "@/lib/orders/informacja-via-daily-panel";

/** Pozycja informacyjna widoczna w kolejce przyjęcia magazynu. */
export function isInformacjaWarehouseQueueOrder(
  order: Pick<
    IndividualOrder,
    "request_kind" | "status" | "informacja_queue_via_daily_panel" | "sales_cancelled_at"
  >
): boolean {
  if (order.request_kind !== "informacja") return false;
  if (order.sales_cancelled_at) return false;

  if (order.status === "Zamowione" || order.status === "Czesciowo_zrealizowane") {
    return true;
  }

  if (order.status === "Nowe" && !isInformacjaQueueViaDailyPanel(order)) {
    return true;
  }

  return false;
}

export function informacjaWarehouseQueueActionLabel(
  status: IndividualOrder["status"]
): string {
  if (status === "Nowe") {
    return "Na magazynie — wyślij e-mail";
  }
  return "Dotarło — powiadom handlowca";
}
