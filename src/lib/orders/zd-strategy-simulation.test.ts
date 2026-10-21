import { describe, expect, it } from "vitest";
import {
  applyZdDemandFloorToLine,
  effectiveDniZapasu,
  type ZdSupplierOrderPolicy,
} from "@/lib/orders/zd-demand-policy";
import { buildManualZdEstimateResult } from "@/lib/orders/zd-estimate-manual";

const strategy: ZdSupplierOrderPolicy = { strategy: "max30_90", targetDays: 25, cycleDays: 7 };

/**
 * Symulacja dzień po dniu: sprzedaż z półki, zamówienia co `cycle` dni liczone prawdziwym
 * Kreatorem (cel z okna sprzedaży, korekty za sprzedażą), dostawa po `lead` dniach.
 * Sprzedaż w oknie to to, co faktycznie zeszło (jak w Subiekcie przy braku).
 */
function simulate(input: {
  demand: (day: number) => number;
  days: number;
  lead: number;
  cycle: number;
  windowDays: number;
  dniZapasu: (day: number) => number;
  zapasMin?: number;
  startStock: number;
}) {
  let stock = input.startStock;
  const sold: number[] = [];
  const arrivals = new Map<number, number>();
  let stockoutDays = 0;
  let stockSum = 0;
  const orders: number[] = [];
  for (let day = 0; day < input.days; day += 1) {
    stock += arrivals.get(day) ?? 0;
    const want = input.demand(day);
    const s = Math.min(stock, want);
    stock -= s;
    sold.push(s);
    if (day >= 150 && want > s) stockoutDays += 1;
    if (day >= 150) stockSum += stock;
    if (day % input.cycle === 0 && day >= 90) {
      const salesWindow = sold.slice(-input.windowDays).reduce((a, b) => a + b, 0);
      const sales90 = sold.slice(-90).reduce((a, b) => a + b, 0);
      let openZd = 0;
      for (const [d, q] of arrivals) if (d > day) openZd += q;
      const dni = input.dniZapasu(day);
      const zapasMin = input.zapasMin ?? 0;
      // Podłoga 90 d strategii jak w silniku (max z tempa okna i średniej 90 d).
      const line = applyZdDemandFloorToLine(
        {
          tw_Id: 1,
          tw_Symbol: "A",
          sprzedazOkres: salesWindow,
          sprzedazDziennie: salesWindow / input.windowDays,
          dostepne: stock,
          otwarteZd: openZd,
          celZapasu: (salesWindow / input.windowDays) * dni + zapasMin,
        },
        { policy: strategy, sales90, dniOkresu: input.windowDays, dniZapasu: dni }
      );
      const res = buildManualZdEstimateResult({ dniZapasu: dni, dniOkresu: input.windowDays, zapasMin }, [line], {
        salesTrack: true,
        salesTrackCuts: true,
      });
      const qty = res.pozycje[0]!.doZamowieniaReczne;
      orders.push(qty);
      if (qty > 0) arrivals.set(day + input.lead, (arrivals.get(day + input.lead) ?? 0) + qty);
    }
  }
  const measured = input.days - 150;
  return { stockoutDays, avgStock: stockSum / measured, orders };
}

/** Deterministyczny szum ±80% wokół średniej (powtarzalny w CI). */
function noisy(mean: (day: number) => number, seed0 = 7) {
  let seed = seed0;
  const values: number[] = [];
  return (day: number) => {
    while (values.length <= day) {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      values.push(Math.round(mean(values.length) * (0.2 + 1.6 * (seed / 2147483648))));
    }
    return values[day]!;
  };
}

describe("strategia max30_90 na dłuższym oknie - symulacja 15 miesięcy", () => {
  // Rozruch zapasem na ~5 miesięcy: pierwsze zamówienie w dniu 90 (pełne okno 90 d), pomiar od 150.
  const base = { days: 600, cycle: 7, startStock: 600 };
  const days30 = () => effectiveDniZapasu(strategy, 30, { leadDays: 30, nextOrderDays: 3 });

  it("dni celu: cykl + dostawa + 25% dostawy, nie mniej niż dni strategii", () => {
    expect(days30()).toBe(45);
    expect(effectiveDniZapasu(strategy, 30, { leadDays: 5, nextOrderDays: 3 })).toBe(25);
    expect(effectiveDniZapasu(strategy, 30)).toBe(25);
    const noCycle: ZdSupplierOrderPolicy = { strategy: "max30_90", targetDays: 25, cycleDays: null };
    expect(effectiveDniZapasu(noCycle, 30, { leadDays: 30, nextOrderDays: 7 })).toBe(45);
  });

  it("dostawa 30 dni, stały popyt: same dni strategii (25) kończą towar, nowe dni nie", () => {
    const demand = () => 4;
    const only25 = simulate({ ...base, demand, lead: 30, windowDays: 30, dniZapasu: () => 25 });
    const now = simulate({ ...base, demand, lead: 30, windowDays: 30, dniZapasu: days30 });
    expect(only25.stockoutDays).toBeGreaterThan(20);
    expect(now.stockoutDays).toBe(0);
  });

  it("dostawa 30 dni, sprzedaż ±80% dziennie: bez braków i bez nadmiaru", () => {
    const demand = noisy(() => 4);
    const noBuffer = simulate({ ...base, demand, lead: 30, windowDays: 30, dniZapasu: () => 37 });
    const now = simulate({ ...base, demand, lead: 30, windowDays: 30, dniZapasu: days30 });
    expect(noBuffer.stockoutDays).toBeGreaterThan(10);
    expect(now.stockoutDays).toBe(0);
    // Średnio poniżej 20 dni sprzedaży na półce.
    expect(now.avgStock).toBeLessThan(4 * 20);
  });

  it("okno sprzedaży 90 zamiast 30 dni: przy stałym popycie te same zamówienia", () => {
    const run = (windowDays: number) =>
      simulate({ ...base, demand: () => 4, lead: 30, windowDays, dniZapasu: days30 });
    const w30 = run(30);
    const w90 = run(90);
    expect(w90.stockoutDays).toBe(0);
    expect(w90.orders.slice(-10)).toEqual(w30.orders.slice(-10));
  });

  it("krótka dostawa (5 dni): wygrywają dni strategii, bez braków", () => {
    const r = simulate({
      ...base,
      demand: noisy(() => 4, 11),
      lead: 5,
      windowDays: 30,
      dniZapasu: () => effectiveDniZapasu(strategy, 30, { leadDays: 5, nextOrderDays: 3 }),
    });
    expect(r.stockoutDays).toBe(0);
  });

  it("popyt rośnie 2× (dostawa 30 dni): przejście krótsze niż bez bufora", () => {
    const demand = (d: number) => (d < 250 ? 4 : 8);
    const noBuffer = simulate({ ...base, demand, lead: 30, windowDays: 30, dniZapasu: () => 37 });
    const now = simulate({ ...base, demand, lead: 30, windowDays: 30, dniZapasu: days30 });
    expect(now.stockoutDays).toBeLessThan(noBuffer.stockoutDays / 2);
    expect(now.stockoutDays).toBeLessThan(30);
  });
});
