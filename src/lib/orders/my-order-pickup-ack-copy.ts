/** Spójne etykiety potwierdzenia odbioru / dostępności w /moje. */

export type MyOrderPickupAckMode = "pickup" | "teeth_handover" | "availability";

export const MY_ORDER_PICKUP_ACK_LABEL = "Potwierdź odbiór";
export const MY_ORDER_TEETH_ACK_LABEL = "Potwierdź odbiór zębów";
export const MY_ORDER_AVAILABILITY_ACK_LABEL = "Potwierdź";
export const MY_ORDER_PICKUP_ACK_LINE_LABEL = "Potwierdź tę pozycję";
export const MY_ORDER_PICKUP_ACK_ALL_LABEL = "Potwierdź wszystko";

export type MyOrderPickupAckLabelOptions = {
  /** Krótka forma na liście — wiersz już ma status „Gotowe”. */
  compact?: boolean;
};

/** Krótka etykieta przycisku — ta sama forma na karcie i w pasku zbiorczym. */
export function myOrderPickupAckLabel(
  pendingCount: number,
  mode: MyOrderPickupAckMode = "pickup",
  options?: MyOrderPickupAckLabelOptions
): string {
  if (mode === "availability") return MY_ORDER_AVAILABILITY_ACK_LABEL;
  if (mode === "teeth_handover") {
    const n = Math.max(0, Math.trunc(pendingCount));
    if (options?.compact) return "Potwierdź";
    if (n > 1) return `${MY_ORDER_TEETH_ACK_LABEL} (${n})`;
    return MY_ORDER_TEETH_ACK_LABEL;
  }
  const n = Math.max(0, Math.trunc(pendingCount));
  if (options?.compact) {
    return "Potwierdź";
  }
  if (n > 1) return `${MY_ORDER_PICKUP_ACK_LABEL} (${n})`;
  return MY_ORDER_PICKUP_ACK_LABEL;
}

/** Etykieta potwierdzenia pojedynczej pozycji w rozwiniętej liście produktów. */
export function myOrderPickupAckLineLabel(): string {
  return MY_ORDER_PICKUP_ACK_LINE_LABEL;
}

/** Etykieta zbiorczego potwierdzenia na dole rozwiniętej listy. */
export function myOrderPickupAckAllLabel(): string {
  return MY_ORDER_PICKUP_ACK_ALL_LABEL;
}

/** Opis akcji dla jednej pozycji (title / aria-label). */
export function myOrderPickupAckLineTitle(
  product: string,
  mode: MyOrderPickupAckMode = "pickup"
): string {
  const suffix = product.trim() ? `: ${product.trim()}` : "";
  if (mode === "availability") {
    return `Potwierdzam powiadomienie o dostępności${suffix}`;
  }
  if (mode === "teeth_handover") {
    return `Potwierdzam odbiór zębów od magazynu${suffix}`;
  }
  return `Potwierdzam odbiór towaru z magazynu${suffix}`;
}

/** Pełny opis dla title / aria-label. */
export function myOrderPickupAckTitle(
  pendingCount: number,
  mode: MyOrderPickupAckMode = "pickup"
): string {
  if (mode === "availability") {
    return "Potwierdzam, że widziałem/am powiadomienie o dostępności";
  }
  if (mode === "teeth_handover") {
    const base = "Potwierdzam, że odebrałem/am zęby od magazynu";
    const n = Math.max(0, Math.trunc(pendingCount));
    if (n > 1) return `${base} — ${n} poz.`;
    return base;
  }
  const base = "Potwierdzam odbiór towaru z magazynu";
  const n = Math.max(0, Math.trunc(pendingCount));
  if (n > 1) return `${base} — ${n} poz.`;
  return base;
}
