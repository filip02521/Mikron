import { formatSubiektKontrahentLabel } from "@/lib/subiekt/match-supplier";
import { lookupSubiektKontrahentByKhId } from "@/lib/subiekt/lookup-kontrahent";

const DEFAULT_CONCURRENCY = 4;

/** Nazwa kontrahenta do wyświetlenia (gdy brak odpowiedzi z API). */
export function fallbackKontrahentDisplay(khId: number): string {
  return `Kontrahent (id ${khId})`;
}

export function kontrahentDisplayName(
  label: string | null | undefined,
  khId: number
): string {
  const trimmed = label?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallbackKontrahentDisplay(khId);
}

/**
 * Uzupełnia brakujące etykiety z API Subiekta.
 * `prefilled` — np. z kolumny subiekt_kh_label w indeksie ZD (bez wywołania API).
 */
export async function resolveSubiektKontrahentLabels(
  khIds: number[],
  options?: {
    concurrency?: number;
    prefilled?: Map<number, string> | Record<number, string>;
  }
): Promise<Map<number, string>> {
  const map = new Map<number, string>();
  const prefilled = options?.prefilled;
  if (prefilled instanceof Map) {
    for (const [kh, label] of prefilled.entries()) {
      if (label?.trim()) map.set(Math.trunc(kh), label.trim());
    }
  } else if (prefilled) {
    for (const [key, label] of Object.entries(prefilled)) {
      const kh = Math.trunc(Number(key));
      if (label?.trim() && Number.isFinite(kh) && kh > 0) {
        map.set(kh, label.trim());
      }
    }
  }

  const unique = [
    ...new Set(
      khIds.map((id) => Math.trunc(id)).filter((id) => Number.isFinite(id) && id > 0 && !map.has(id))
    ),
  ];
  if (unique.length === 0) return map;

  const concurrency = Math.max(1, options?.concurrency ?? DEFAULT_CONCURRENCY);
  for (let i = 0; i < unique.length; i += concurrency) {
    const chunk = unique.slice(i, i + concurrency);
    await Promise.all(
      chunk.map(async (kh) => {
        try {
          const k = await lookupSubiektKontrahentByKhId(kh);
          if (k) map.set(kh, formatSubiektKontrahentLabel(k));
        } catch {
          /* zostaw bez etykiety */
        }
      })
    );
  }
  return map;
}

export function labelsMapToRecord(map: Map<number, string>): Record<number, string> {
  const out: Record<number, string> = {};
  for (const [kh, label] of map.entries()) {
    out[kh] = label;
  }
  return out;
}
