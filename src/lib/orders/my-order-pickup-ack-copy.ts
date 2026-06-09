/** Spójne etykiety potwierdzenia odbioru / dostępności w /moje. */

export type MyOrderPickupAckMode = "pickup" | "availability";

export const MY_ORDER_PICKUP_ACK_LABEL = "Potwierdź odbiór";
export const MY_ORDER_AVAILABILITY_ACK_LABEL = "Potwierdź";

/** Krótka etykieta przycisku — ta sama forma na karcie i w pasku zbiorczym. */
export function myOrderPickupAckLabel(
  pendingCount: number,
  mode: MyOrderPickupAckMode = "pickup"
): string {
  if (mode === "availability") return MY_ORDER_AVAILABILITY_ACK_LABEL;
  const n = Math.max(0, Math.trunc(pendingCount));
  if (n > 1) return `${MY_ORDER_PICKUP_ACK_LABEL} (${n})`;
  return MY_ORDER_PICKUP_ACK_LABEL;
}

/** Pełny opis dla title / aria-label. */
export function myOrderPickupAckTitle(
  pendingCount: number,
  mode: MyOrderPickupAckMode = "pickup"
): string {
  if (mode === "availability") {
    return "Potwierdzam, że widziałem/am powiadomienie o dostępności";
  }
  const base = "Potwierdzam odbiór towaru z magazynu";
  const n = Math.max(0, Math.trunc(pendingCount));
  if (n > 1) return `${base} — ${n} poz.`;
  return base;
}
