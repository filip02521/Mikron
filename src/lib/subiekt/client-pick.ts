import { formatSubiektKontrahentLabel } from "@/lib/subiekt/match-supplier";
import type { SubiektKontrahent } from "@/lib/subiekt/types";

export const MIN_CLIENT_SEARCH_LENGTH = 2;

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
