import { describe, expect, it, vi } from "vitest";
import {
  fetchProsbaStockDeduplicated,
  prosbaStockTwIdsKey,
  readProsbaStockCache,
  resetProsbaStockFetchCache,
  writeProsbaStockCache,
} from "./prosba-stock-fetch-cache";

describe("prosba-stock-fetch-cache", () => {
  it("deduplikuje równoległe zapytania o ten sam zestaw tw_Id", async () => {
    resetProsbaStockFetchCache();
    const fetcher = vi.fn(async () => ({
      1: { onHand: 5, reserved: 0, available: 5, source: "subiekt" as const },
    }));
    const key = prosbaStockTwIdsKey([1]);

    const [a, b] = await Promise.all([
      fetchProsbaStockDeduplicated(key, [1], fetcher),
      fetchProsbaStockDeduplicated(key, [1], fetcher),
    ]);

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(a).toEqual(b);
    expect(readProsbaStockCache(key)).toEqual(a);
  });

  it("zwraca wpis z cache bez ponownego fetchu", async () => {
    resetProsbaStockFetchCache();
    const key = prosbaStockTwIdsKey([2]);
    writeProsbaStockCache(key, {
      2: { onHand: 1, reserved: 0, available: 1, source: "subiekt" },
    });
    const fetcher = vi.fn(async () => ({}));
    const stock = await fetchProsbaStockDeduplicated(key, [2], fetcher);
    expect(fetcher).not.toHaveBeenCalled();
    expect(stock[2]?.available).toBe(1);
  });
});
