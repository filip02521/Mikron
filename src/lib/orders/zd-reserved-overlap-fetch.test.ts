import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/subiekt/api", () => ({ fetchSubiektZdEstimateZkPage: vi.fn() }));
vi.mock("@/lib/orders/zd-estimate-reservations", () => ({ fetchAllReservedZkRowsForTwId: vi.fn() }));

import { fetchAllReservedZkRowsForTwId } from "@/lib/orders/zd-estimate-reservations";
import { fetchSubiektZdEstimateZkPage } from "@/lib/subiekt/api";
import {
  clearReservedOverlapCache,
  fetchReservedOverlapSlicesByTwIds,
} from "@/lib/orders/zd-reserved-overlap-fetch";

const fetchAll = vi.mocked(fetchAllReservedZkRowsForTwId);

function rowsFor(twId: number) {
  return {
    rows: twId % 2 ? [{ quantity: 3, clientKhId: 501, zkNumber: `ZK ${twId}/10/2026` }] : [],
    truncated: false,
    scannedApiRows: 1,
    summary: null,
  } as unknown as Awaited<ReturnType<typeof fetchAllReservedZkRowsForTwId>>;
}

beforeEach(() => {
  clearReservedOverlapCache();
  fetchAll.mockReset();
  fetchAll.mockImplementation(async ({ twId }) => rowsFor(twId));
});

describe("fetchReservedOverlapSlicesByTwIds", () => {
  it("pobiera każdy tw raz i zwraca tylko niepuste rezerwacje", async () => {
    const res = await fetchReservedOverlapSlicesByTwIds([11, 12, 11, 0, -4]);
    expect(fetchAll).toHaveBeenCalledTimes(2);
    expect(res.hadFetchErrors).toBe(false);
    expect([...res.reservedByTwId.keys()]).toEqual([11]);
    expect(res.reservedByTwId.get(11)).toEqual([{ quantity: 3, clientKhId: 501, zkNumber: "ZK 11/10/2026" }]);
  });

  it("create korzysta z wyniku Policz, w tym pustych tw", async () => {
    await fetchReservedOverlapSlicesByTwIds([11, 12]);
    fetchAll.mockClear();
    const res = await fetchReservedOverlapSlicesByTwIds([11, 12, 13], { cacheMaxAgeMs: 60_000 });
    expect(fetchAll.mock.calls.map(([a]) => a.twId)).toEqual([13]);
    expect([...res.reservedByTwId.keys()].sort()).toEqual([11, 13]);
  });

  it("bez cacheMaxAgeMs zawsze pobiera świeżo", async () => {
    await fetchReservedOverlapSlicesByTwIds([11]);
    await fetchReservedOverlapSlicesByTwIds([11]);
    expect(fetchAll).toHaveBeenCalledTimes(2);
  });

  it("błąd tw nie trafia do cache i ustawia hadFetchErrors", async () => {
    fetchAll.mockRejectedValueOnce(new Error("timeout"));
    const first = await fetchReservedOverlapSlicesByTwIds([11]);
    expect(first.hadFetchErrors).toBe(true);
    const second = await fetchReservedOverlapSlicesByTwIds([11], { cacheMaxAgeMs: 60_000 });
    expect(second.hadFetchErrors).toBe(false);
    expect(fetchAll).toHaveBeenCalledTimes(2);
  });

  it("po deadline nie startuje kolejnych tw", async () => {
    const res = await fetchReservedOverlapSlicesByTwIds([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], {
      deadlineAt: Date.now() - 1,
    });
    expect(fetchAll).not.toHaveBeenCalled();
    expect(res.hadFetchErrors).toBe(true);
  });

  it("deadline przerywa stronicowanie trwającego tw", async () => {
    const page = vi.mocked(fetchSubiektZdEstimateZkPage);
    page.mockResolvedValue({ data: {} } as Awaited<ReturnType<typeof fetchSubiektZdEstimateZkPage>>);
    fetchAll.mockImplementation(async ({ twId, fetchPage }) => {
      await fetchPage({ towarId: twId, tylkoBezRez: false, page: 1, pageSize: 100 });
      await new Promise((r) => setTimeout(r, 20));
      await fetchPage({ towarId: twId, tylkoBezRez: false, page: 2, pageSize: 100 });
      return rowsFor(twId);
    });

    const inTime = await fetchReservedOverlapSlicesByTwIds([1], { deadlineAt: Date.now() + 60_000 });
    expect(inTime.hadFetchErrors).toBe(false);
    expect(page).toHaveBeenCalledTimes(2);

    page.mockClear();
    const late = await fetchReservedOverlapSlicesByTwIds([3], { deadlineAt: Date.now() + 5 });
    expect(late.hadFetchErrors).toBe(true);
    expect(page).toHaveBeenCalledTimes(1);
    const retry = await fetchReservedOverlapSlicesByTwIds([3], { cacheMaxAgeMs: 60_000 });
    expect(retry.reservedByTwId.has(3)).toBe(true);
  });

  it("nie przekracza limitu równoległych pobrań", async () => {
    let active = 0;
    let peak = 0;
    fetchAll.mockImplementation(async ({ twId }) => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 2));
      active -= 1;
      return rowsFor(twId);
    });
    const ids = Array.from({ length: 40 }, (_, i) => i + 1);
    const res = await fetchReservedOverlapSlicesByTwIds(ids);
    expect(fetchAll).toHaveBeenCalledTimes(40);
    expect(peak).toBeLessThanOrEqual(6);
    expect(res.reservedByTwId.size).toBe(20);
  });
});
