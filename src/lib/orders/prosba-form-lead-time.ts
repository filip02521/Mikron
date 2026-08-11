import {
  formatSupplierLeadTimeBrief,
  totalSampleCount,
} from "@/lib/orders/delivery-eta";
import type { DeliveryStats, StatsMode } from "@/types/database";

/** Tooltip przy meta średniego czasu na formularzu prośby. */
export const PROSBA_FORM_LEAD_TIME_TOOLTIP =
  "Orientacyjny czas od złożenia zamówienia u dostawcy do przyjęcia na magazyn (dni robocze). Nie obejmuje urlopu dostawcy i nie jest gwarancją terminu.";

/** Krótka etykieta przy polu dostawcy (przed wyborem produktu). */
export const PROSBA_FORM_LEAD_TIME_LABEL = "Średni czas";

/**
 * Subtelna linia pod „Powiązano z Subiektem” / „Z bazy” —
 * bez osobnego nagłówka, w tonie hintu pod polem.
 */
export const PROSBA_FORM_LEAD_TIME_UNDER_LINK_PREFIX = "Orientacyjnie";

export type ProsbaFormLeadTimeMeta = {
  /** np. "~8 dni rob." albo "gł. ~10 d · pob. ~5 d" */
  primaryText: string;
  /** np. "24 dostawy" — null gdy brak próbek (nie powinno wystąpić przy hasData) */
  sampleText: string | null;
  lowConfidence: boolean;
  tooltip: string;
};

function sampleCountLabel(n: number): string {
  if (n === 1) return "1 dostawa";
  if (n >= 2 && n <= 4) return `${n} dostawy`;
  return `${n} dostaw`;
}

/**
 * Subtelna meta na formularzu prośby — tylko gdy jest historia dostaw.
 * Bez daty kalendarzowej i bez alert-boxa.
 */
export function buildProsbaFormLeadTimeMeta(
  stats: DeliveryStats | null | undefined,
  statsMode: StatsMode
): ProsbaFormLeadTimeMeta | null {
  const brief = formatSupplierLeadTimeBrief(stats, statsMode);
  if (!brief) return null;

  const sampleCount = totalSampleCount(stats);
  const lowConfidence = sampleCount > 0 && sampleCount < 3;
  const primaryText = brief.replace(/\s·\sszacunek$/, "");

  return {
    primaryText,
    sampleText: sampleCount > 0 ? sampleCountLabel(sampleCount) : null,
    lowConfidence,
    tooltip: PROSBA_FORM_LEAD_TIME_TOOLTIP,
  };
}

/** Unikalne ID dostawców z linii; gdy brak — opcjonalny fallback (np. ?dostawca=). */
export function collectProsbaLeadTimeSupplierIds(
  lines: Array<{ supplierId?: string | null }>,
  fallbackSupplierId?: string | null
): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const line of lines) {
    const id = line.supplierId?.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  if (ids.length === 0) {
    const fallback = fallbackSupplierId?.trim();
    if (fallback) ids.push(fallback);
  }
  return ids;
}
