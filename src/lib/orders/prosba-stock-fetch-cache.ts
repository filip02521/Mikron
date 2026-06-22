import type { ProsbaLineStockSnapshot } from "@/lib/orders/prosba-stock-check";

const STOCK_CACHE_TTL_MS = 90_000;

type CacheEntry = {
  at: number;
  stock: Record<number, ProsbaLineStockSnapshot>;
};

const stockCache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<Record<number, ProsbaLineStockSnapshot>>>();

export function prosbaStockTwIdsKey(twIds: number[]): string {
  return [...new Set(twIds.filter((id) => id > 0).map((id) => Math.trunc(id)))]
    .sort((a, b) => a - b)
    .join(",");
}

export function readProsbaStockCache(
  twIdsKey: string
): Record<number, ProsbaLineStockSnapshot> | null {
  const entry = stockCache.get(twIdsKey);
  if (!entry) return null;
  if (Date.now() - entry.at > STOCK_CACHE_TTL_MS) {
    stockCache.delete(twIdsKey);
    return null;
  }
  return entry.stock;
}

export function writeProsbaStockCache(
  twIdsKey: string,
  stock: Record<number, ProsbaLineStockSnapshot>
): void {
  stockCache.set(twIdsKey, { at: Date.now(), stock });
}

export async function fetchProsbaStockDeduplicated(
  twIdsKey: string,
  ids: number[],
  fetcher: (twIds: number[]) => Promise<Record<number, ProsbaLineStockSnapshot>>
): Promise<Record<number, ProsbaLineStockSnapshot>> {
  const cached = readProsbaStockCache(twIdsKey);
  if (cached) return cached;

  let promise = inflight.get(twIdsKey);
  if (!promise) {
    promise = fetcher(ids).then((stock) => {
      writeProsbaStockCache(twIdsKey, stock);
      return stock;
    });
    inflight.set(twIdsKey, promise);
    void promise.finally(() => {
      if (inflight.get(twIdsKey) === promise) {
        inflight.delete(twIdsKey);
      }
    });
  }
  return promise;
}

/** Reset cache (testy). */
export function resetProsbaStockFetchCache(): void {
  stockCache.clear();
  inflight.clear();
}
