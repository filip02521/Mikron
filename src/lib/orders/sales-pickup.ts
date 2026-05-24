import type { IndividualOrder } from "@/types/database";
import { isInformacjaRequest } from "@/lib/orders/individual";

/** U handlowca: zielona pozycja „odbierz z magazynu” (całość przyjęta, bez potwierdzenia). */
export function isAwaitingSalesPickup(order: IndividualOrder): boolean {
  if (isInformacjaRequest(order)) return false;
  if (order.sales_cancelled_at) return false;
  return order.status === "Zrealizowane" && !order.sales_acknowledged_at;
}

/** Prośba informacyjna: towar na magazynie — handlowiec potwierdza zapoznanie z powiadomieniem. */
export function isAwaitingInformacjaAck(order: IndividualOrder): boolean {
  if (!isInformacjaRequest(order)) return false;
  if (order.sales_cancelled_at) return false;
  return order.status === "Zrealizowane" && !order.sales_acknowledged_at;
}

/** Dowolna pozycja wymagająca potwierdzenia na liście „Moje”. */
export function isAwaitingSalesAck(order: IndividualOrder): boolean {
  return isAwaitingSalesPickup(order) || isAwaitingInformacjaAck(order);
}
