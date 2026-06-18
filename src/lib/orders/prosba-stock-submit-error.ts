import { isProsbaStockAckRequiredError } from "@/lib/orders/prosba-stock-check";

/** Obsługa odrzucenia zapisu przez serwer (świeższy stan z Subiekta). */
export function handleProsbaStockSubmitError(
  error: unknown,
  onAckRequired: (message: string) => void,
  onOtherError: (message: string) => void
): void {
  const message = error instanceof Error ? error.message : "Nie udało się zapisać prośby.";
  if (isProsbaStockAckRequiredError(message)) {
    onAckRequired(message);
    return;
  }
  onOtherError(message);
}
