/** Prośba do ZD: produkt (tw_Id z Subiekta) i opis do pokazania w oknie wysyłki. */
export type ZdSendRequest = { orderId: string; twId: number | null; label: string; quantity: string | null };

/**
 * Które prośby są w wysyłanym ZD: produkt prośby jest na pozycjach dokumentu (stan z Subiekta w chwili
 * wysyłki — także po ręcznych zmianach). Prośba bez produktu z Subiekta nie jest „w ZD” — nie zgadujemy.
 */
export function requestsCoveredByZd(
  requests: readonly ZdSendRequest[],
  lines: readonly { twId?: number | null }[]
): { inZd: ZdSendRequest[]; notInZd: ZdSendRequest[] } {
  const onZd = new Set(lines.map((l) => Math.trunc(Number(l.twId) || 0)).filter((id) => id > 0));
  const inZd: ZdSendRequest[] = [];
  const notInZd: ZdSendRequest[] = [];
  for (const r of requests) (r.twId != null && onZd.has(r.twId) ? inZd : notInZd).push(r);
  return { inZd, notInZd };
}
