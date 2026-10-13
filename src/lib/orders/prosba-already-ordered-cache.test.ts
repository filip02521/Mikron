import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchProsbaAlreadyOrdered,
  invalidateProsbaAlreadyOrdered,
  readProsbaAlreadyOrderedCache,
  resetProsbaAlreadyOrderedCache,
} from "@/lib/orders/prosba-already-ordered-cache";
import type { ProsbaAlreadyOrderedInfo, ProsbaAlreadyOrderedMap } from "@/lib/orders/prosba-already-ordered";

type Fetcher = (ids: number[], forSalesPersonId: string | null) => Promise<ProsbaAlreadyOrderedMap>;

const hit: ProsbaAlreadyOrderedInfo = {
  own: [],
  incoming: { incoming: 3, available: 0, zkWaiting: 0, freeIncoming: 3, docs: [] },
};

afterEach(() => resetProsbaAlreadyOrderedCache());

describe("prosba-already-ordered-cache", () => {
  it("pyta tylko o brakujące towary; „nic nie znaleziono” też jest zapamiętane", async () => {
    const fetcher = vi.fn<Fetcher>(async (ids): Promise<ProsbaAlreadyOrderedMap> => (ids.includes(1) ? { 1: hit } : {}));
    await fetchProsbaAlreadyOrdered([1, 2], fetcher);
    await fetchProsbaAlreadyOrdered([1, 2, 3], fetcher);
    expect(fetcher.mock.calls.map((c) => c[0])).toEqual([[1, 2], [3]]);
    expect(readProsbaAlreadyOrderedCache([1, 2, 3])).toEqual({ 1: hit });
  });

  it("równoległe wywołania dzielą jedno zapytanie", async () => {
    let resolve!: (v: Record<number, ProsbaAlreadyOrderedInfo>) => void;
    const fetcher = vi.fn<Fetcher>(() => new Promise<ProsbaAlreadyOrderedMap>((r) => (resolve = r)));
    const a = fetchProsbaAlreadyOrdered([7], fetcher);
    const b = fetchProsbaAlreadyOrdered([7], fetcher);
    resolve({ 7: hit });
    expect(await a).toEqual({ 7: hit });
    expect(await b).toEqual({ 7: hit });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("„moja prośba” zależy od handlowca — osobny wpis per handlowiec", async () => {
    const fetcher = vi.fn<Fetcher>(async () => ({ 5: hit }));
    await fetchProsbaAlreadyOrdered([5], fetcher, "sp-a");
    await fetchProsbaAlreadyOrdered([5], fetcher, "sp-b");
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[1]![1]).toBe("sp-b");
  });

  it("po wysłaniu prośby towar jest sprawdzany od nowa", async () => {
    const fetcher = vi.fn<Fetcher>(async () => ({}));
    await fetchProsbaAlreadyOrdered([9], fetcher, "sp-a");
    invalidateProsbaAlreadyOrdered([9]);
    await fetchProsbaAlreadyOrdered([9], fetcher, "sp-a");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("zapytanie w toku przy wysłaniu prośby nie wraca do cache", async () => {
    let resolve!: (v: ProsbaAlreadyOrderedMap) => void;
    const slow = vi.fn<Fetcher>(() => new Promise<ProsbaAlreadyOrderedMap>((r) => (resolve = r)));
    const pending = fetchProsbaAlreadyOrdered([9], slow, "sp-a");
    invalidateProsbaAlreadyOrdered([9]);
    resolve({ 9: hit });
    await pending;
    expect(readProsbaAlreadyOrderedCache([9], "sp-a", true)).toEqual({});
    const fresh = vi.fn<Fetcher>(async () => ({}));
    await fetchProsbaAlreadyOrdered([9], fresh, "sp-a");
    expect(fresh).toHaveBeenCalledTimes(1);
  });

  it("wysyłka czyta także wynik po TTL — to samo, co pokazuje karta", async () => {
    vi.useFakeTimers();
    try {
      await fetchProsbaAlreadyOrdered([3], vi.fn<Fetcher>(async () => ({ 3: hit })));
      vi.advanceTimersByTime(120_000);
      expect(readProsbaAlreadyOrderedCache([3])).toEqual({});
      expect(readProsbaAlreadyOrderedCache([3], null, true)).toEqual({ 3: hit });
    } finally {
      vi.useRealTimers();
    }
  });

  it("ponad 30 towarów (duży ZK) — kilka zapytań, nic nie pominięte", async () => {
    const ids = Array.from({ length: 65 }, (_, i) => i + 1);
    const fetcher = vi.fn<Fetcher>(async (chunk) => Object.fromEntries(chunk.map((id) => [id, hit])));
    const map = await fetchProsbaAlreadyOrdered(ids, fetcher);
    expect(fetcher.mock.calls.map((c) => c[0].length)).toEqual([30, 30, 5]);
    expect(Object.keys(map)).toHaveLength(65);
  });

  it("błąd serwera = brak podpowiedzi, bez wyjątku", async () => {
    const fetcher = vi.fn<Fetcher>(async () => {
      throw new Error("offline");
    });
    await expect(fetchProsbaAlreadyOrdered([4], fetcher)).resolves.toEqual({});
  });
});
