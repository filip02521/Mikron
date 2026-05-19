import type { IndividualOrder } from "@/types/database";
import { isInformacjaRequest } from "@/lib/orders/individual";

/** U handlowca: zielona pozycja „odbierz z magazynu” (całość przyjęta, bez potwierdzenia). */
export function isAwaitingSalesPickup(order: IndividualOrder): boolean {
  if (isInformacjaRequest(order)) return false;
  if (order.sales_cancelled_at) return false;
  return order.status === "Zrealizowane" && !order.sales_acknowledged_at;
}
