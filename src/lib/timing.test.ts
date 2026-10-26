import { describe, expect, it, vi } from "vitest";
import {
  awaitWithinBudget,
  clientFetchTimeoutMs,
  createTimeoutAbort,
  isTimeBudgetExceeded,
  lockTtlSecondsForBudgetMs,
  withTimeoutAbort,
} from "./timing";

describe("lockTtlSecondsForBudgetMs", () => {
  it("dodaje zapas do budżetu", () => {
    expect(lockTtlSecondsForBudgetMs(280_000)).toBe(280 + 60);
    expect(lockTtlSecondsForBudgetMs(50_000, 30)).toBe(50 + 30);
    expect(lockTtlSecondsForBudgetMs(1_500)).toBe(2 + 60);
  });
});

describe("clientFetchTimeoutMs", () => {
  it("jest dłuższy niż budżet serwera", () => {
    expect(clientFetchTimeoutMs(50_000)).toBe(60_000);
    expect(clientFetchTimeoutMs(50_000, 15_000)).toBe(65_000);
  });
});

describe("isTimeBudgetExceeded", () => {
  it("porównuje elapsed z budżetem", () => {
    expect(isTimeBudgetExceeded(1_000, 5_000, 5_999)).toBe(false);
    expect(isTimeBudgetExceeded(1_000, 5_000, 6_000)).toBe(true);
  });
});

describe("createTimeoutAbort / withTimeoutAbort", () => {
  it("abortuje po czasie i czyści timer", async () => {
    const handle = createTimeoutAbort(20);
    expect(handle.signal.aborted).toBe(false);
    await new Promise((r) => setTimeout(r, 40));
    expect(handle.signal.aborted).toBe(true);
    handle.clear();
  });

  it("withTimeoutAbort przekazuje sygnał i czyści po sukcesie", async () => {
    const result = await withTimeoutAbort(1_000, async (signal) => {
      expect(signal.aborted).toBe(false);
      return 42;
    });
    expect(result).toBe(42);
  });
});

describe("awaitWithinBudget", () => {
  it("zwraca wynik, gdy zdąży przed limitem", async () => {
    await expect(awaitWithinBudget(Promise.resolve(7), 1_000)).resolves.toEqual({ value: 7 });
  });

  it("po limicie zwraca null, a praca kończy się w tle", async () => {
    vi.useFakeTimers();
    try {
      let finished = false;
      const slow = new Promise<number>((resolve) =>
        setTimeout(() => {
          finished = true;
          resolve(1);
        }, 5_000)
      );
      const waited = awaitWithinBudget(slow, 1_000);
      await vi.advanceTimersByTimeAsync(1_000);
      await expect(waited).resolves.toBeNull();
      await vi.advanceTimersByTimeAsync(4_000);
      expect(finished).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
