/** Limit produktów w jednej akcji grupowej szacunku ZD. */
export const ZD_ESTIMATE_BULK_MAX = 200;

/**
 * Unikalne, poprawne tw_Id w kolejności wejścia, ucięte do limitu.
 */
export function normalizeZdEstimateBulkTwIds(
  ids: number[],
  max = ZD_ESTIMATE_BULK_MAX
): { ids: number[]; truncated: boolean } {
  const limit = Math.max(1, Math.trunc(max));
  const seen = new Set<number>();
  const out: number[] = [];
  let truncated = false;
  for (const raw of ids) {
    const id = Math.trunc(raw);
    if (!Number.isFinite(id) || id <= 0 || seen.has(id)) continue;
    if (out.length >= limit) {
      truncated = true;
      break;
    }
    seen.add(id);
    out.push(id);
  }
  return { ids: out, truncated };
}

export type ZdEstimateBulkProductInput = {
  subiektTwId: number;
  twSymbol?: string | null;
  twNazwa: string;
  grtId?: number | null;
  grtNazwa?: string | null;
};

/**
 * Deduplikuje produkty po tw_Id (pierwszy wygrywa), ucina do limitu.
 */
export function normalizeZdEstimateBulkProducts(
  products: ZdEstimateBulkProductInput[],
  max = ZD_ESTIMATE_BULK_MAX
): { products: ZdEstimateBulkProductInput[]; truncated: boolean } {
  const limit = Math.max(1, Math.trunc(max));
  const seen = new Set<number>();
  const out: ZdEstimateBulkProductInput[] = [];
  let truncated = false;
  for (const p of products) {
    const id = Math.trunc(p.subiektTwId);
    if (!Number.isFinite(id) || id <= 0 || seen.has(id)) continue;
    const twNazwa = p.twNazwa.trim();
    if (!twNazwa) continue;
    if (out.length >= limit) {
      truncated = true;
      break;
    }
    seen.add(id);
    out.push({
      subiektTwId: id,
      twSymbol: p.twSymbol?.trim() || null,
      twNazwa,
      grtId: p.grtId ?? null,
      grtNazwa: p.grtNazwa?.trim() || null,
    });
  }
  return { products: out, truncated };
}

/**
 * Najpóźniejsza poprawna data wystawienia FS (YYYY-MM-DD) spośród wierszy.
 * Nie zakłada kolejności z API.
 */
export function pickLatestFsDateKey(
  rows: Array<{ dok_DataWyst?: string | null }>
): string | null {
  let latest: string | null = null;
  for (const row of rows) {
    const key = String(row.dok_DataWyst ?? "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) continue;
    if (!latest || key > latest) latest = key;
  }
  return latest;
}

/** Czy dociągnięcie stron estimate jest niepełne / ucięte limitem. */
export function isZdEstimateFetchIncomplete(input: {
  pagesFetched: number;
  totalPages: number;
  maxPages: number;
  pozycjeCount: number;
  totalCountApi: number;
  /** Pętla przerwana przed wyczerpaniem zaplanowanych stron (pusta / zła strona). */
  stoppedEarly: boolean;
}): boolean {
  const totalPages = Math.max(1, input.totalPages);
  const maxPages = Math.max(1, input.maxPages);
  const pagesToFetch = Math.min(totalPages, maxPages);
  if (totalPages > maxPages) return true;
  if (input.stoppedEarly) return true;
  if (input.pagesFetched < pagesToFetch) return true;
  if (
    input.totalCountApi > 0 &&
    input.pozycjeCount < input.totalCountApi &&
    input.pagesFetched < totalPages
  ) {
    return true;
  }
  return false;
}
