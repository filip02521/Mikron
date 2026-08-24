import type { IndividualOrder } from "@/types/database";
import { isInformacjaRequest } from "@/lib/orders/individual";
import { calculateBusinessDays, parseDateOnly } from "@/lib/orders/dates";
import { orderPlacementAt } from "@/lib/orders/order-timing";
import { todayInWarsaw } from "@/lib/time/warsaw";

/**
 * Ile dni roboczych prośba czeka w przyjęciu (od „Zamówione u dostawcy”).
 * null = informacja / brak daty złożenia.
 */
export function receiveQueueWaitingBusinessDays(
  order: Pick<IndividualOrder, "ordered_at" | "action_at" | "status" | "request_kind">
): number | null {
  if (isInformacjaRequest(order)) return null;
  const placement = orderPlacementAt(order);
  if (!placement) return null;
  const start = parseDateOnly(placement);
  if (!start) return null;
  const today = todayInWarsaw();
  if (start > today) return 0;
  return calculateBusinessDays(start, today);
}

/** Najstarsza (max) liczba dni oczekiwania w grupie zamówień. */
export function maxReceiveQueueWaitingDays(
  orders: ReadonlyArray<
    Pick<IndividualOrder, "ordered_at" | "action_at" | "status" | "request_kind">
  >
): number | null {
  let max: number | null = null;
  for (const order of orders) {
    const days = receiveQueueWaitingBusinessDays(order);
    if (days == null) continue;
    if (max == null || days > max) max = days;
  }
  return max;
}

export function receiveQueueWaitingDaysLabel(days: number): string {
  return days === 1 ? "1 dzień" : `${days} dni`;
}
