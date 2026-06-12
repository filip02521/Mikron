import { fulfillmentProgressFor } from "@/lib/orders/sales-cancel";
import type { IndividualOrder } from "@/types/database";

function fulfillmentCrossProgress(order: IndividualOrder) {
  return fulfillmentProgressFor(order);
}

/** Etykieta w kolejce przyjęcia: część już na regale, reszta u dostawcy. */
export function partialReceiveCrossLabel(order: IndividualOrder): string | null {
  const progress = fulfillmentCrossProgress(order);
  if (!progress.hasNumericQty) return null;

  if (
    order.sales_cancelled_at &&
    progress.cancelled > 0 &&
    progress.supplierRemaining != null &&
    progress.supplierRemaining > 0 &&
    progress.delivered <= 0
  ) {
    return `Aktywne ${progress.supplierRemaining} szt. (z ${progress.ordered} · ${progress.cancelled} wycofane)`;
  }

  if (order.status !== "Czesciowo_zrealizowane") return null;
  if (progress.delivered <= 0) return null;
  const remaining = progress.supplierRemaining ?? progress.remaining ?? 0;
  if (remaining > 0) {
    return `${progress.delivered} szt. na regale · brakuje ${remaining} u dostawcy`;
  }
  return `${progress.delivered} szt. na regale`;
}

/** Etykieta na regale: reszta zamówienia nadal czeka u dostawcy. */
export function partialShelfCrossLabel(order: IndividualOrder): string | null {
  const progress = fulfillmentCrossProgress(order);
  const remaining = progress.supplierRemaining ?? progress.remaining ?? 0;
  if (!progress.hasNumericQty || remaining <= 0) return null;
  if (order.status !== "Czesciowo_zrealizowane" && progress.delivered <= 0) return null;
  return `U dostawcy jeszcze ${remaining} szt.`;
}
