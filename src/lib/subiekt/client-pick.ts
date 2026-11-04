import { formatSubiektKontrahentLabel } from "@/lib/subiekt/match-supplier";
import { expandSupplierSearchQueries } from "@/lib/subiekt/supplier-search-tokens";
import type { SubiektKontrahent } from "@/lib/subiekt/types";

export const MIN_CLIENT_SEARCH_LENGTH = 2;

/**
 * Frazy do szukania klienta w Subiekcie. API szuka podciągu, a NIP w kartotekach bywa zapisany
 * cyframi, z myślnikami (3-3-2-2 lub 3-2-2-3) albo z prefiksem kraju — dla NIP-u pytamy o każdy zapis.
 */
export function clientSearchPhrases(query: string): string[] {
  const q = query.trim();
  const nip = /^(?:[A-Z]{2}[\s-]*)?([\d\s-]*\d)$/i.exec(q);
  const digits = nip?.[1].replace(/\D/g, "") ?? "";
  if (digits.length === 10) return nipSearchVariants(digits);
  return digits.length >= MIN_CLIENT_SEARCH_LENGTH ? [digits] : expandSupplierSearchQueries(q);
}

function nipSearchVariants(d: string): string[] {
  return [d, `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6, 8)}-${d.slice(8)}`, `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5, 7)}-${d.slice(7)}`];
}

/** Po wyborze z listy (kh_Id) nie szukamy ponownie — pełna etykieta często nie trafia w API. */
export function shouldRunSubiektClientSearch(
  query: string,
  clientKhId: number | null | undefined
): boolean {
  if (clientKhId != null && clientKhId > 0) return false;
  return query.trim().length >= MIN_CLIENT_SEARCH_LENGTH;
}

export function formatClientSearchResultCount(n: number): string {
  if (n === 1) return "1 wynik";
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} wyniki`;
  return `${n} wyników`;
}

/** Scala wyniki Subiekta bez duplikatów kh_Id (i etykiet bez id). */
export function mergeKontrahenciUnique(
  target: SubiektKontrahent[],
  seenKh: Set<number>,
  seenLabels: Set<string>,
  rows: SubiektKontrahent[],
  limit: number
): void {
  for (const row of rows) {
    if (target.length >= limit) return;
    const khId = Number(row.kh_Id);
    if (Number.isFinite(khId) && khId > 0) {
      if (seenKh.has(khId)) continue;
      seenKh.add(khId);
    } else {
      const labelKey = formatSubiektKontrahentLabel(row).toLowerCase();
      if (seenLabels.has(labelKey)) continue;
      seenLabels.add(labelKey);
    }
    target.push(row);
  }
}

export function formatSubiektKontrahentOption(k: SubiektKontrahent): {
  title: string;
  subtitle: string | undefined;
} {
  const title = formatSubiektKontrahentLabel(k);
  const parts = [
    k.adr_NIP?.trim() ? `NIP: ${k.adr_NIP.trim()}` : null,
    k.adr_Miejscowosc?.trim() ?? null,
    (k.adr_Telefon ?? k.kh_Telefon)?.trim() ?? null,
  ].filter(Boolean);
  return {
    title,
    subtitle: parts.length ? parts.join(" · ") : undefined,
  };
}
