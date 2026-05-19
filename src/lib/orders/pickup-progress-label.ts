import type { MyOrderRow } from "@/lib/orders/my-order-presenter";

/** Skrót postępu odbioru na karcie grupy (np. „2/5 odebrane”). */
export function pickupProgressLabel(row: MyOrderRow): string | null {
  if (row.acknowledgeMode !== "pickup" || row.pickupReadyTotal <= 1) {
    return null;
  }
  const done = row.pickupAcknowledgedCount;
  const total = row.pickupReadyTotal;
  if (done > 0) {
    return `${done}/${total} odebrane`;
  }
  if (row.pickupPendingCount > 0) {
    return `${row.pickupPendingCount} poz. do odbioru`;
  }
  return null;
}
