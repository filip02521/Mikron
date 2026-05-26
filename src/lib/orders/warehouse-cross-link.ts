import { getDeliveryProgress } from "@/lib/orders/individual";
import type { IndividualOrder } from "@/types/database";

/** Etykieta w kolejce przyjęcia: część już na regale, reszta u dostawcy. */
export function partialReceiveCrossLabel(order: IndividualOrder): string | null {
  if (order.status !== "Czesciowo_zrealizowane") return null;
  const progress = getDeliveryProgress(order.quantity, order.delivered_quantity);
  if (!progress.hasNumericQty || progress.delivered <= 0) return null;
  const remaining = progress.remaining ?? 0;
  if (remaining > 0) {
    return `${progress.delivered} szt. na regale · brakuje ${remaining} u dostawcy`;
  }
  return `${progress.delivered} szt. na regale`;
}

/** Etykieta na regale: reszta zamówienia nadal czeka u dostawcy. */
export function partialShelfCrossLabel(order: IndividualOrder): string | null {
  if (order.status !== "Czesciowo_zrealizowane") return null;
  const progress = getDeliveryProgress(order.quantity, order.delivered_quantity);
  const remaining = progress.remaining ?? 0;
  if (!progress.hasNumericQty || remaining <= 0) return null;
  return `U dostawcy jeszcze ${remaining} szt.`;
}
