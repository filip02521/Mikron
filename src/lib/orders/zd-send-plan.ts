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

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
/** Najdalszy rozsądny termin dostawy — dalej to prawie na pewno pomyłka w dacie. */
const MAX_DAYS_AHEAD = 400;

/** Termin dostawy na ZD po wysyłce: null = poprawny, inaczej komunikat dla osoby. */
export function zdTerminError(date: string, today: string): string | null {
  if (!DATE_RE.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
    return "Podaj termin realizacji w formacie RRRR-MM-DD.";
  }
  if (date < today) return "Termin realizacji nie może być wcześniejszy niż dziś.";
  const daysAhead = (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000;
  if (daysAhead > MAX_DAYS_AHEAD) return "Termin realizacji jest dalej niż rok - sprawdź datę.";
  return null;
}
