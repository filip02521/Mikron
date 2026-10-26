import { describe, expect, it } from "vitest";
import { evaluateZdBacktest, zdBacktestRowParams, zdBacktestRunStale, type ZdBacktestContext } from "@/lib/data/zd-backtest-run";
import { addDaysKey, type ZdBacktestInput } from "@/lib/orders/zd-backtest";

describe("przerwany backtest", () => {
  const now = Date.parse("2026-10-24T12:00:00Z");
  it("w toku ponad 45 min = przerwany; świeży i zakończony — nie", () => {
    expect(zdBacktestRunStale("running", "2026-10-24T11:00:00Z", now)).toBe(true);
    expect(zdBacktestRunStale("queued", "2026-10-24T11:00:00Z", now)).toBe(true);
    expect(zdBacktestRunStale("running", "2026-10-24T11:30:00Z", now)).toBe(false);
    expect(zdBacktestRunStale("done", "2026-10-20T11:00:00Z", now)).toBe(false);
  });
  it("parametry wiersza: puste przed wynikiem v3 = brak", () => {
    expect(zdBacktestRowParams({})).toBeNull();
    expect(zdBacktestRowParams(null)).toBeNull();
    expect(zdBacktestRowParams({ cycleDays: 7, targetDays: 25 })).toEqual({ cycleDays: 7, targetDays: 25 });
  });
});

describe("ocena przebiegu — szuka ustawień i zapisuje je jako params", () => {
  const START = "2025-10-23";
  const products = Array.from({ length: 6 }, (_, i) => ({ id: i + 1, cost: 10 + i, margin: 5, active: true, pack: null }));
  const demand = new Map(products.map((p) => [p.id, Array.from({ length: 300 }, (_, d) => [addDaysKey(START, d - 200), 1 + (p.id % 3)] as const)]));
  const snapshots = Array.from({ length: 101 }, (_, d) => ({ day: addDaysKey(START, d - 1), qty: new Map(products.map((p) => [p.id, d % 9 === 0 ? 0 : 20])) }));
  const lead = Array.from({ length: 10 }, (_, i) => ({
    placement_date: addDaysKey(START, -300 + i * 20),
    delivery_date: addDaysKey(START, -295 + i * 20),
    business_days_full: 3,
    business_days_first: 3,
    order_type: "Glowne",
    source: "subiekt",
  }));
  const input = { simStart: START, days: 100, windowDays: 30, products, demand, snapshots, lead } as unknown as ZdBacktestInput;
  const ctx: ZdBacktestContext = {
    simStart: START,
    simEnd: addDaysKey(START, 99),
    kreatorDays: 30,
    supplierCycle: 14,
    statsMode: "LACZNIE",
    trackPreset: "wyłączone",
    names: new Map(),
    pairs: 0,
    explodedBoms: 0,
    skipped: { excluded: 0, onRequest: 0 },
  };
  it("wynik v3: params = najlepsze z siatki, warianty przy nich, postęp szukania do końca", async () => {
    const progress: Array<{ phase: string; done: number; total: number }> = [];
    const r = await evaluateZdBacktest(input, ctx, async (p) => void progress.push(p));
    expect(r.version).toBe(3);
    expect(r.params).not.toBeNull();
    expect(r.params).toEqual({ cycleDays: r.recommended!.cycleDays, targetDays: r.recommended!.targetDays });
    expect(r.variants.map((v) => v.key)).toEqual(["kreator", "automat", "pessimistic"]);
    expect(r.variants[1]!.settings).toBe(`${r.params!.cycleDays === 1 ? "codziennie" : `co ${r.params!.cycleDays} dni`}, cel ${r.params!.targetDays} dni`);
    expect(r.searched!.points).toBe(r.grid.length);
    const last = progress.at(-1)!;
    expect(last.phase).toBe("search");
    expect(last.done).toBe(last.total);
  }, 60_000);
});
