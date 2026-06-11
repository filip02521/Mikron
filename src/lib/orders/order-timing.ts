import type { IndividualOrder } from "@/types/database";

/** Data zgłoszenia prośby przez handlowca. */
export function submittedAt(order: Pick<IndividualOrder, "action_at">): string {
  return order.action_at;
}

/**
 * Początek liczenia czasu realizacji — moment „Zamówione u dostawcy”.
 * Dla starych rekordów bez ordered_at: przy statusie po „Nowe” używamy action_at.
 */
export function orderPlacementAt(
  order: Pick<IndividualOrder, "ordered_at" | "action_at" | "status">
): string | null {
  if (order.ordered_at) return order.ordered_at;
  if (
    order.status === "Zamowione" ||
    order.status === "Czesciowo_zrealizowane" ||
    order.status === "Zrealizowane"
  ) {
    return order.action_at;
  }
  return null;
}

export function hasPlacementStarted(
  order: Pick<IndividualOrder, "ordered_at" | "action_at" | "status">
): boolean {
  return orderPlacementAt(order) != null;
}

export function canEstimateDeliveryEta(
  order: Pick<IndividualOrder, "ordered_at" | "action_at" | "status">
): boolean {
  const placement = orderPlacementAt(order);
  if (!placement) return false;
  const s = order.status;
  return s === "Zamowione" || s === "Czesciowo_zrealizowane";
}
