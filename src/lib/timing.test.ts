import { describe, expect, it } from "vitest";
import {
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
