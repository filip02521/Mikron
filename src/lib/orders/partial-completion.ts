/**
 * Częściowa → pełna realizacja to nowe przyjęcie (dotarła reszta towaru), a nie korekta ilości:
 * odświeża delivery_at i zdejmuje auto-ack z regału, żeby handlowiec dostał prośbę o odbiór.
 */
export function completesPartialDelivery(prevStatus: string | null | undefined, status: string): boolean {
  return prevStatus === "Czesciowo_zrealizowane" && status === "Zrealizowane";
}
