import type { IndividualOrder } from "@/types/database";
import { isInformacjaRequest } from "@/lib/orders/individual";

/** Tor zakupów: standardowy panel dzienny vs panel zębów. */
export type ProcurementLane = "regular" | "teeth";

export type DeliveryQueueLane = ProcurementLane | "all";

type TeethOrderLike = Pick<IndividualOrder, "is_teeth"> | null | undefined;

type TeethZamowienieLike = Pick<IndividualOrder, "is_teeth" | "request_kind"> | null | undefined;

/** Pozycja oznaczona jako zębowa (dowolny request_kind). */
export function isTeethOrder(order: TeethOrderLike): boolean {
  return Boolean(order?.is_teeth);
}

/** Zamówienie zębowe (nie informacja) — wspólny filtr kolejek i historii. */
export function isTeethZamowienie(order: TeethZamowienieLike): boolean {
  if (!order || !order.is_teeth) return false;
  return !isInformacjaRequest(order as IndividualOrder);
}

export function procurementLane(order: TeethZamowienieLike): ProcurementLane {
  return isTeethZamowienie(order) ? "teeth" : "regular";
}

export function partitionOrdersByProcurementLane<T extends IndividualOrder>(
  orders: T[]
): { regular: T[]; teeth: T[] } {
  const regular: T[] = [];
  const teeth: T[] = [];
  for (const order of orders) {
    if (isTeethZamowienie(order)) teeth.push(order);
    else regular.push(order);
  }
  return { regular, teeth };
}

export function filterDeliveryQueueByLane<T extends IndividualOrder>(
  orders: T[],
  lane: DeliveryQueueLane
): T[] {
  if (lane === "all") return orders;
  if (lane === "teeth") return orders.filter(isTeethZamowienie);
  return orders.filter((o) => !isTeethZamowienie(o));
}

/** Kanoniczna data złożenia zamówienia u labu (tor zębów). */
export function teethProcurementOrderedAt(
  order: Pick<IndividualOrder, "teeth_ordered_at" | "ordered_at">
): string | null {
  const teethAt = order.teeth_ordered_at?.trim();
  if (teethAt) return teethAt;
  return order.ordered_at?.trim() || null;
}

/** Planowana / nadpisana data dostawy zębów (tor zębów). */
export function teethProcurementDeliveryEta(
  order: Pick<IndividualOrder, "teeth_delivery_date">
): string | null {
  return order.teeth_delivery_date?.trim() || null;
}
