import { describe, expect, it } from "vitest";
import {
  addDaysKey,
  simulateZdBacktest,
  zdBacktestGrid,
  zdBacktestHiddenOutflowShare,
  zdBacktestLeadDays,
  zdBacktestReality,
  zdBacktestVerdict,
  type ZdBacktestInput,
  type ZdBacktestMetrics,
} from "@/lib/orders/zd-backtest";

const START = "2025-10-23";
/** Jeden towar: 2 szt dziennie przez 200 dni przed startem i przez cały okres, dostawa 3 dni rob. */
function input(over: Partial<ZdBacktestInput> = {}, perDay = 2, startStock = 60): ZdBacktestInput {
  const demand: Array<[string, number]> = [];
  for (let i = -200; i < 120; i++) demand.push([addDaysKey(START, i), perDay]);
  const snapshots = Array.from({ length: 17 }, (_, w) => ({
    day: addDaysKey(START, -1 + w * 7),
    qty: new Map([[1, w === 0 ? startStock : 10]]),
  }));
  return {
    simStart: START,
    days: 112,
    products: [{ id: 1, cost: 10, active: true, pack: null }],
    demand: new Map([[1, demand]]),
    snapshots,
    lead: Array.from({ length: 10 }, (_, i) => ({ placementDate: addDaysKey(START, -300 + i * 20), fullDays: 3, firstDays: 3 })),
    ...over,
  };
}

describe("simulateZdBacktest", () => {
  it("stała sprzedaż i krótka dostawa: automat co 7 dni nie ma braków", () => {
    const m = simulateZdBacktest(input(), { kind: "automat", targetDays: 25, cycleDays: 7, arrival: "first" });
    expect(m.zeroShare).toBe(0);
    expect(m.servedShare).toBe(100);
    expect(m.orders).toBeGreaterThan(10);
    // cel 25 dni × 2 szt × 10 zł = 500 zł — średni zapas w okolicy celu, nie wielokrotność
    expect(m.avgStock).toBeGreaterThan(200);
    expect(m.avgStock).toBeLessThan(700);
  });
  it("bez zapasu startowego i z cyklem 28 dni Kreator na 7 dni sprzedaży ma braki", () => {
    const m = simulateZdBacktest(input({}, 2, 0), { kind: "kreator", days: 7, cycleDays: 28 });
    expect(m.zeroShare!).toBeGreaterThan(0);
    expect(m.servedShare!).toBeLessThan(100);
  });
  it("opakowanie: zamówienia przychodzą w pełnych paczkach", () => {
    const base = input();
    const m = simulateZdBacktest(
      { ...base, products: [{ ...base.products[0]!, pack: { unitsPerPackage: 50, documentUnitMode: "packages", orderMultiple: null } }] },
      { kind: "automat", targetDays: 25, cycleDays: 7, arrival: "first" }
    );
    expect(m.zeroShare).toBe(0);
    expect(m.orders).toBeLessThan(simulateZdBacktest(base, { kind: "automat", targetDays: 25, cycleDays: 7, arrival: "first" }).orders);
  });
});

describe("czas dostawy", () => {
  it("p90 do pierwszej dostawy zamiast pełnej realizacji (pozycje z zaległości)", () => {
    const lead = Array.from({ length: 10 }, (_, i) => ({ placementDate: addDaysKey(START, -100 + i * 5), fullDays: i < 8 ? 5 : 60, firstDays: 5 }));
    expect(zdBacktestLeadDays(lead, START, "full")).toBeGreaterThan(60);
    expect(zdBacktestLeadDays(lead, START, "first")).toBe(7);
  });
  it("próbki po dniu decyzji są niewidoczne; brak próbek → 7 dni", () => {
    expect(zdBacktestLeadDays([{ placementDate: addDaysKey(START, 5), fullDays: 40, firstDays: 40 }], START, "first")).toBe(7);
    expect(zdBacktestLeadDays([], START, "first")).toBe(7);
  });
});

describe("rzeczywistość i rozchód bez sprzedaży", () => {
  it("zdjęcia stanu: zero i średnia wartość", () => {
    const r = zdBacktestReality(input({}, 2, 0));
    expect(r.zeroShare).toBeCloseTo(100 / 17, 5);
  });
  it("spadek stanu większy niż sprzedaż = rozchód bez sprzedaży", () => {
    const base = input();
    const snaps = [
      { day: addDaysKey(START, -1), qty: new Map([[1, 100]]) },
      { day: addDaysKey(START, 6), qty: new Map([[1, 76]]) }, // sprzedaż 14 → 10 szt zniknęło bez sprzedaży
    ];
    expect(zdBacktestHiddenOutflowShare({ ...base, snapshots: snaps })).toBeCloseTo((10 / 14) * 100, 5);
  });
});

const m = (zeroShare: number, avgStock: number): ZdBacktestMetrics => ({ zeroShare, avgStock, servedShare: 95, orders: 50, medianOrder: 1000, quarters: [] });
const quality = { activeSkus: 30, pricedActiveShare: 100, leadSamples: 40 };

describe("werdykt", () => {
  const reality = { zeroShare: 10, avgStock: 1000 };
  it("mniej braków, zapas do +10%, pesymistycznie nie gorzej niż +1 pp — działa", () => {
    const v = zdBacktestVerdict({ reality, automat: m(6, 1100), pessimistic: m(11, 1100), quality });
    expect(v.kind).toBe("works");
    expect(v.headline).toBe("Schemat działa: o 40% mniej braków i o 10% więcej zapasu niż było naprawdę");
  });
  it("mniej braków, ale zapas ponad +10% — kompromis", () => {
    expect(zdBacktestVerdict({ reality, automat: m(6, 1101), pessimistic: m(8, 1101), quality }).kind).toBe("tradeoff");
  });
  it("wrażliwe na opóźnienia — kompromis", () => {
    const v = zdBacktestVerdict({ reality, automat: m(6, 900), pessimistic: m(11.5, 900), quality });
    expect(v.kind).toBe("tradeoff");
    expect(v.headline.startsWith("Działa przy zwykłych dostawach")).toBe(true);
  });
  it("mniej zapasu, braki do +2 pp — kompromis; więcej — nie działa", () => {
    expect(zdBacktestVerdict({ reality, automat: m(12, 700), pessimistic: m(13, 700), quality }).kind).toBe("tradeoff");
    expect(zdBacktestVerdict({ reality, automat: m(12.5, 700), pessimistic: m(13, 700), quality }).kind).toBe("fails");
  });
  it("za mało danych: mało towarów, cen albo dostaw", () => {
    expect(zdBacktestVerdict({ reality, automat: m(1, 1), pessimistic: m(1, 1), quality: { ...quality, activeSkus: 4 } }).kind).toBe("insufficient");
    expect(zdBacktestVerdict({ reality, automat: m(1, 1), pessimistic: m(1, 1), quality: { ...quality, pricedActiveShare: 79 } }).kind).toBe("insufficient");
    expect(zdBacktestVerdict({ reality, automat: m(1, 1), pessimistic: m(1, 1), quality: { ...quality, leadSamples: 4 } }).reasons[0]).toContain("4 zmierzonych dostaw");
  });
});

describe("siatka ustawień i rekomendacja", () => {
  it("rekomenduje najmniejszy zapas wśród działających; brak działających → najmniej braków", () => {
    const base = input();
    const reality = { zeroShare: 50, avgStock: 10_000 };
    const { grid, recommended } = zdBacktestGrid(base, reality, { targets: [20, 40], cycles: [7, 14] });
    expect(grid).toHaveLength(4);
    expect(grid.every((g) => g.works)).toBe(true);
    const minStock = Math.min(...grid.map((g) => g.avgStock));
    expect(recommended!.avgStock).toBe(minStock);
    const none = zdBacktestGrid(base, { zeroShare: 0, avgStock: 1 }, { targets: [20, 40], cycles: [7] });
    expect(none.grid.some((g) => g.works)).toBe(false);
    expect(none.recommended).not.toBeNull();
  });
});
