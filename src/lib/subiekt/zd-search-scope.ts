import { defaultZdSearchDataOd } from "@/lib/subiekt/subiekt-runtime-cache";

/** Live search / lista ZD u kontrahenta — tylko świeże dokumenty (szybsze API + indeks). */
export const ZD_CONTRACTOR_RECENT_MONTHS = 3;

/** Dolna granica daty wystawienia ZD dla wyszukiwań scoped per kh_Id / dostawca. */
export function zdContractorRecentDataOd(at: Date = new Date()): string {
  const monthsBack = ZD_CONTRACTOR_RECENT_MONTHS;
  const d = new Date(at);
  d.setMonth(d.getMonth() - monthsBack);
  return d.toISOString().slice(0, 10);
}

/** Ogólne wyszukiwanie produktowe (bez kh_Id) — szerszy zakres niż u kontrahenta. */
export function zdProductSearchDataOd(): string {
  return defaultZdSearchDataOd(18);
}
