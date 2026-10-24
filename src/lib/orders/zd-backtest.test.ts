import { describe, expect, it } from "vitest";
import { policyForBoostPreset } from "@/lib/orders/zd-estimate-boost-presets";
import {
  addDaysKey,
  simulateZdBacktest,
  zdBacktestGrid,
  zdBacktestHiddenOutflowShare,
  zdBacktestImputedShare,
  zdBacktestLeadDays,
  zdBacktestReality,
  zdBacktestSplitProsbaSales,
  zdBacktestStableQuarters,
  zdBacktestVerdict,
  type ZdBacktestInput,
  type ZdBacktestLeadSample,
  type ZdBacktestMetrics,
  type ZdBacktestReality,
} from "@/lib/orders/zd-backtest";

const START = "2025-10-23"; // czwartek
const sample = (placement: string, full: number, first: number | null = full, over: Partial<ZdBacktestLeadSample> = {}): ZdBacktestLeadSample => ({
  placement_date: placement,
  delivery_date: addDaysKey(placement, Math.ceil(full * 1.4)),
  business_days_full: full,
  business_days_first: first,
  order_type: "Glowne",
  source: "subiekt",
  ...over,
});
const lead3 = Array.from({ length: 10 }, (_, i) => sample(addDaysKey(START, -300 + i * 20), 3));

/** Jeden towar: `perDay` szt dziennie przez 200 dni przed startem i przez cały okres, dostawa 3 dni rob. */
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
    windowDays: 30,
    products: [{ id: 1, cost: 10, margin: 5, active: true, pack: null }],
    demand: new Map([[1, demand]]),
    snapshots,
    lead: lead3,
    imputeLostDemand: false,
    ...over,
  };
}
const automat = (targetDays = 25, cycleDays = 7) => ({ kind: "automat" as const, targetDays, cycleDays, arrival: "first" as const });

describe("simulateZdBacktest — jak nocny przebieg", () => {
  it("stała sprzedaż i krótka dostawa: automat co 7 dni nie ma braków, zapas w okolicy celu", () => {
    const m = simulateZdBacktest(input(), automat());
    expect(m.zeroShare).toBe(0);
    expect(m.servedShare).toBe(100);
    expect(m.orders).toBeGreaterThan(10);
    expect(m.lostMargin).toBe(0);
    // cel 25 dni × 2 szt × 10 zł = 500 zł — średni zapas w okolicy celu, nie wielokrotność
    expect(m.avgStock).toBeGreaterThan(200);
    expect(m.avgStock).toBeLessThan(700);
    expect(m.cost).toBeCloseTo(m.avgStock * 0.2 * (112 / 365), 6);
  });

  it("Kreator: cel = sprzedaż z okna dni zapasu dostawcy (okno 60 d ⇒ zapas ≈ 2× okna 30 d)", () => {
    const k30 = simulateZdBacktest(input({ windowDays: 30 }), { kind: "kreator", days: 30, cycleDays: 7 });
    const k60 = simulateZdBacktest(input({ windowDays: 60 }), { kind: "kreator", days: 60, cycleDays: 7 });
    expect(k60.avgStock / k30.avgStock).toBeGreaterThan(1.6);
  });

  it("bez zapasu startowego i z cyklem 28 dni Kreator na 7 dni sprzedaży ma braki i traci marżę", () => {
    const m = simulateZdBacktest(input({ windowDays: 7 }, 2, 0), { kind: "kreator", days: 7, cycleDays: 28 });
    expect(m.zeroShare!).toBeGreaterThan(0);
    expect(m.servedShare!).toBeLessThan(100);
    expect(m.lostMargin).toBeGreaterThan(0);
  });

  it("opakowanie: zamówienia przychodzą w pełnych paczkach", () => {
    const base = input();
    const m = simulateZdBacktest(
      { ...base, products: [{ ...base.products[0]!, pack: { unitsPerPackage: 50, documentUnitMode: "packages", orderMultiple: null } }] },
      automat()
    );
    expect(m.zeroShare).toBe(0);
    expect(m.orders).toBeLessThan(simulateZdBacktest(base, automat()).orders);
  });

  it("minimum stanów: towar bez sprzedaży dobijany do minimum", () => {
    const base = input({}, 0, 0);
    const m = simulateZdBacktest({ ...base, products: [{ ...base.products[0]!, minStock: 5, active: false }] }, automat());
    expect(m.avgStock).toBeGreaterThan(40); // 5 szt × 10 zł po pierwszej dostawie
    expect(simulateZdBacktest(base, automat()).avgStock).toBe(0);
  });

  it("sprzedaż pod prośby: automat odejmuje ją z okna, Kreator liczy całą", () => {
    // Jednorazowe prośby co 60 dni — w oknie 30 d automat ich nie widzi.
    const prosba = new Map([[1, [-150, -90, -30, 30, 90].map((d) => [addDaysKey(START, d), 30] as const)]]);
    const ratio = (kind: "automat" | "kreator") => {
      const pol = kind === "automat" ? automat() : ({ kind: "kreator", days: 30, cycleDays: 7 } as const);
      return simulateZdBacktest(input({ prosba }), pol).avgStock / simulateZdBacktest(input(), pol).avgStock;
    };
    expect(ratio("kreator")).toBeGreaterThan(1.05);
    expect(ratio("automat")).toBeLessThan(ratio("kreator"));
  });

  it("jak silnik: podłoga 90 d odejmuje prośby tylko z ostatniego okna 30 d (starsze zostają w podłodze)", () => {
    const prosba = new Map([[1, Array.from({ length: 300 }, (_, i) => [addDaysKey(START, -180 + i), 2] as const)]]);
    const a = simulateZdBacktest(input(), automat());
    expect(simulateZdBacktest(input({ prosba }), automat()).avgStock).toBeGreaterThan(a.avgStock);
  });

  it("braki w oknie podnoszą tempo (korekta dni braku), para / komplet bez korekty", () => {
    // Popyt 4/d, start bez stanu, dostawa 15 dni rob.: pierwsze tygodnie bez towaru — system widzi mniej sprzedaży.
    const slow = Array.from({ length: 10 }, (_, i) => sample(addDaysKey(START, -300 + i * 20), 15));
    const base = input({ lead: slow }, 4, 0);
    const withAdj = simulateZdBacktest(base, automat(25, 7));
    const composite = simulateZdBacktest({ ...base, products: [{ ...base.products[0]!, composite: true }] }, automat(25, 7));
    expect(withAdj.zeroShare!).toBeLessThan(composite.zeroShare!);
    expect(withAdj.servedShare!).toBeGreaterThan(composite.servedShare!);
  });

  it("podążanie za sprzedażą zmienia ilości (preset z ustawień), wyłączone = czysty cel", () => {
    const off = simulateZdBacktest(input(), automat());
    const on = simulateZdBacktest(input({ trackPolicy: policyForBoostPreset("standard") }), automat());
    expect(on.avgStock).not.toBe(off.avgStock);
  });

  it("braki i zapas liczone dziennie: wynik nie zależy od dnia tygodnia zdjęć stanu", () => {
    const base = input({}, 2, 0);
    const shifted = { ...base, snapshots: base.snapshots.map((s, i) => (i === 0 ? s : { ...s, day: addDaysKey(s.day, 3) })) };
    expect(simulateZdBacktest(shifted, automat()).zeroShare).toBeCloseTo(simulateZdBacktest(base, automat()).zeroShare!, 6);
  });
});

describe("zamówienia klientów (ZK) i nowe towary", () => {
  // 1 szt dziennie z półki + jedno zamówienie klienta na 40 szt (ZK 10 dni przed FS)
  const withZk = (zkDaysBefore: number) => {
    const base = input({}, 1, 10);
    const fsDay = addDaysKey(START, 50);
    const demand = new Map([[1, [...base.demand.get(1)!, [fsDay, 40, addDaysKey(fsDay, -zkDaysBefore)] as const]]]);
    return { ...base, demand };
  };
  const walkIn = () => {
    const base = input({}, 1, 10);
    return simulateZdBacktest({ ...base, demand: new Map([[1, [...base.demand.get(1)!, [addDaysKey(START, 50), 40] as const]]]) }, automat());
  };
  it("rezerwacja widoczna od dnia ZK: automat domawia na zamówienie i wydaje je w terminie", () => {
    const m = simulateZdBacktest(withZk(10), automat());
    expect(m.zk.qty).toBe(40);
    expect(m.zk.lateQty).toBe(0);
    // rezerwacja trzyma stan, więc półka może chwilę stać pusta — ale strata dużo mniejsza niż bez ZK
    expect(m.lostMargin).toBeLessThan(walkIn().lostMargin / 2);
  });
  it("ZK wystawione dzień przed FS: brak stanu = klient czeka (opóźnienie), zamówienia nie tracimy", () => {
    const m = simulateZdBacktest(withZk(1), automat());
    expect(m.zk.qty).toBe(40);
    expect(m.zk.lateQty).toBe(40);
    expect(m.zk.avgDelayDays!).toBeGreaterThan(0);
    expect(m.lostMargin).toBeLessThan(walkIn().lostMargin);
  });
  it("ta sama sprzedaż bez ZK (z półki) = utracona marża na brakującej części", () => {
    expect(walkIn().lostMargin).toBeGreaterThan(100);
  });
  it("nowy towar: pierwsza dostawa jak naprawdę, potem automat — nie traci całej sprzedaży", () => {
    const demand: Array<[string, number]> = [];
    for (let i = 30; i < 112; i++) demand.push([addDaysKey(START, i), 1]);
    const snapshots = Array.from({ length: 17 }, (_, w) => ({ day: addDaysKey(START, -1 + w * 7), qty: new Map([[1, w < 4 ? 0 : 20]]) }));
    const base = input({ demand: new Map([[1, demand]]), snapshots });
    const inp = { ...base, products: [{ ...base.products[0]!, active: false }] };
    const m = simulateZdBacktest(inp, automat());
    expect(m.servedShare!).toBeGreaterThan(90);
  });
});

describe("czas dostawy jak horyzont automatu", () => {
  it("p90 do pierwszej dostawy zamiast pełnej realizacji (pozycje z zaległości)", () => {
    const lead = Array.from({ length: 10 }, (_, i) => sample(addDaysKey(START, -150 + i * 5), i < 8 ? 5 : 60, 5));
    expect(zdBacktestLeadDays(lead, START)).toBe(7); // 5 dni rob. = 7 kalendarzowych
  });
  it("próbka znana dopiero po dostawie; brak próbek → 7 dni", () => {
    const pending = [sample(addDaysKey(START, -10), 40)]; // dostarczona po dniu decyzji
    expect(zdBacktestLeadDays(pending, START)).toBe(7);
    expect(zdBacktestLeadDays([], START)).toBe(7);
  });
  it("tryb OSOBNO: tylko zamówienia główne; import i inne źródła przy próbkach z Subiektu pominięte", () => {
    const main = Array.from({ length: 6 }, (_, i) => sample(addDaysKey(START, -200 + i * 10), 3));
    const side = Array.from({ length: 6 }, (_, i) => sample(addDaysKey(START, -190 + i * 10), 30, 30, { order_type: "Poboczne" }));
    const imported = Array.from({ length: 6 }, (_, i) => sample(addDaysKey(START, -195 + i * 10), 50, 50, { source: "import" }));
    expect(zdBacktestLeadDays([...main, ...side, ...imported], START, "OSOBNO")).toBe(5);
    expect(zdBacktestLeadDays([...main, ...side], START, "LACZNIE")).toBeGreaterThan(30);
  });
});

describe("prośby i dopisany popyt", () => {
  it("prośba zabiera sprzedaż z 14 dni od dostawy, od najwcześniejszej", () => {
    const sales = [["2026-01-01", 3], ["2026-01-05", 2], ["2026-01-10", 4], ["2026-01-30", 5]] as const;
    const r = zdBacktestSplitProsbaSales(sales, [["2026-01-04", 5]]);
    expect(r.prosba).toEqual([["2026-01-05", 2], ["2026-01-10", 3]]);
    expect(r.stock).toEqual([["2026-01-01", 3], ["2026-01-10", 1], ["2026-01-30", 5]]);
  });

  it("tydzień bez towaru między sprzedażami: popyt dopisany z tempa tygodni ze stanem", () => {
    const base = input({ imputeLostDemand: true });
    // tygodnie 5–6 bez stanu i bez sprzedaży
    const demand = new Map([[1, base.demand.get(1)!.filter(([d]) => d < addDaysKey(START, 35) || d > addDaysKey(START, 48))]]);
    const snapshots = base.snapshots.map((s, w) => (w === 5 || w === 6 || w === 7 ? { ...s, qty: new Map([[1, 0]]) } : s));
    const inp = { ...base, demand, snapshots };
    expect(zdBacktestImputedShare(inp)!).toBeGreaterThan(5);
    const r = zdBacktestReality(inp);
    expect(r.lostMargin).toBeGreaterThan(0);
  });

  it("towar wycofany (bez sprzedaży po przerwie) — bez dopisywania", () => {
    const base = input({ imputeLostDemand: true });
    const demand = new Map([[1, base.demand.get(1)!.filter(([d]) => d < addDaysKey(START, 35))]]);
    const snapshots = base.snapshots.map((s, w) => (w >= 5 ? { ...s, qty: new Map([[1, 0]]) } : s));
    expect(zdBacktestImputedShare({ ...base, demand, snapshots })).toBe(0);
  });
});

describe("rzeczywistość i rozchód bez sprzedaży", () => {
  it("zdjęcia stanu: zero, średnia wartość i kwartały", () => {
    const r = zdBacktestReality(input({}, 2, 0));
    expect(r.zeroShare).toBeCloseTo(100 / 17, 5);
    expect(r.quarters).toHaveLength(4);
    expect(r.quarters[0]!.zeroShare).toBeGreaterThan(0);
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

const m = (zeroShare: number, avgStock: number): ZdBacktestMetrics => ({
  zeroShare,
  avgStock,
  servedShare: 95,
  orders: 50,
  medianOrder: 1000,
  lostMargin: 0,
  cost: avgStock * 0.2,
  quarters: [],
  zk: { qty: 0, lateQty: 0, avgDelayDays: null },
});
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

const realityOf = (zeroShare: number, avgStock: number): ZdBacktestReality => ({
  zeroShare,
  avgStock,
  lostMargin: 0,
  cost: avgStock * 0.2,
  quarters: [{ zeroShare }, { zeroShare }, { zeroShare }, { zeroShare }],
});

describe("siatka ustawień i rekomendacja", () => {
  it("rekomenduje najniższy koszt wśród działających; gdy nic nie działa — kolejne progi, każdy po koszcie", () => {
    const base = input();
    const { grid, recommended } = zdBacktestGrid(base, realityOf(50, 10_000), { targets: [20, 40], cycles: [7, 14] });
    expect(grid).toHaveLength(4);
    expect(grid.every((g) => g.works && g.stableQuarters === 4)).toBe(true);
    expect(recommended!.cost).toBe(Math.min(...grid.map((g) => g.cost)));
    expect(recommended!.tier).toBe("works");
    const none = zdBacktestGrid(base, realityOf(0, 1), { targets: [20, 40], cycles: [7] });
    expect(none.grid.some((g) => g.works)).toBe(false);
    // braki 0 = jak dziś, ale zapas ponad dzisiejszy → „mniej braków za cenę zapasu”
    expect(none.recommended!.tier).toBe("more_stock");
    expect(none.recommended!.cost).toBe(Math.min(...none.grid.map((g) => g.cost)));
    const worse = zdBacktestGrid(base, realityOf(-1, 1), { targets: [20, 40], cycles: [7] });
    expect(worse.recommended!.tier).toBe("lowest_cost");
  });
  it("braki kosztują marżę: przy brakach tańszy jest wyższy cel, mimo większego zapasu", () => {
    // Długa dostawa (30 dni rob.), zero na starcie: krótki cykl z dużym celem lepiej obsługuje popyt.
    const slow = Array.from({ length: 10 }, (_, i) => sample(addDaysKey(START, -300 + i * 20), 10));
    const base = input({ lead: slow }, 5, 0);
    const heavy = { ...base, products: [{ ...base.products[0]!, margin: 200 }] };
    const lo = simulateZdBacktest(heavy, automat(15, 21));
    const hi = simulateZdBacktest(heavy, automat(60, 7));
    expect(hi.lostMargin).toBeLessThan(lo.lostMargin);
    expect(hi.cost).toBeLessThan(lo.cost);
  });
  it("stabilność: kwartał trzyma, gdy braki ≤ naprawdę + 0,5 pp", () => {
    const sim = { quarters: [{ zeroShare: 5, avgStock: 0 }, { zeroShare: 5.4, avgStock: 0 }, { zeroShare: 6, avgStock: 0 }, { zeroShare: null, avgStock: 0 }] };
    expect(zdBacktestStableQuarters(sim, realityOf(5, 1))).toBe(2);
  });
});
