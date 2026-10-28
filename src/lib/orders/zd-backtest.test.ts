import { describe, expect, it } from "vitest";
import { policyForBoostPreset } from "@/lib/orders/zd-estimate-boost-presets";
import {
  addDaysKey,
  simulateZdBacktest,
  zdBacktestPickBest,
  zdBacktestSearch,
  zdBacktestHiddenOutflowShare,
  zdBacktestImputedShare,
  zdBacktestLeadDays,
  zdBacktestReality,
  zdBacktestSplitProsbaSales,
  zdBacktestStableQuarters,
  zdBacktestBestVerdict,
  zdBacktestApplyOrderTerms,
  ZD_BACKTEST_ORDER_COST,
  type ZdBacktestInput,
  type ZdBacktestLeadSample,
  type ZdBacktestMetrics,
  type ZdBacktestReality,
  type ZdBacktestGridPoint,
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
    expect(m.cost).toBeCloseTo(m.avgStock * 0.2 * (112 / 365) + m.orders * ZD_BACKTEST_ORDER_COST, 6);
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

  it("jak silnik: podłoga 90 d odejmuje prośby z każdego okna 30 d (starsze nie podnoszą zapasu)", () => {
    const prosba = new Map([[1, Array.from({ length: 300 }, (_, i) => [addDaysKey(START, -180 + i), 2] as const)]]);
    const a = simulateZdBacktest(input(), automat());
    expect(simulateZdBacktest(input({ prosba }), automat()).avgStock).toBeCloseTo(a.avgStock, 6);
    // Jedna duża prośba 45 dni przed decyzjami: bez wpływu na zapas automatu.
    const once = new Map([[1, [[addDaysKey(START, -45), 60] as const]]]);
    expect(simulateZdBacktest(input({ prosba: once }), automat()).avgStock).toBeCloseTo(a.avgStock, 6);
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

describe("minimum zamówienia i darmowa dostawa (jak nocny przebieg)", () => {
  const prod = (id: number, cost: number) => ({ id, cost, active: true, pack: null });
  const c = (id: number, qty: number, cost: number, cover: number) => ({ s: { p: prod(id, cost) }, qty, rate: 1, celTracked: 20, position: cover });
  const ctx = (terms: { minOrderValue: number | null; freeShippingThreshold: number | null }) => ({ terms, cycleDays: 7, leadDays: 3, hasAbc: false });
  it("poniżej minimum bez pilnych — odłożone; z pilną — idzie", () => {
    const calm = [c(1, 5, 10, 30), c(2, 3, 10, 40)];
    expect([...zdBacktestApplyOrderTerms(calm, ctx({ minOrderValue: 500, freeShippingThreshold: null })).values()]).toEqual([0, 0]);
    const urgent = [c(1, 5, 10, 5), c(2, 3, 10, 40)]; // pokrycie 5 dni < cykl 7 + dostawa 3
    expect([...zdBacktestApplyOrderTerms(urgent, ctx({ minOrderValue: 500, freeShippingThreshold: null })).values()]).toEqual([5, 3]);
  });
  it("brakuje ≤ 15% do darmowej dostawy — dopełnienie od najmniej dni pokrycia, do celu + tempo × cykl", () => {
    const cand = [c(1, 9, 10, 30), c(2, 0, 10, 8)]; // 90 zł, próg 100 zł
    const out = zdBacktestApplyOrderTerms(cand, ctx({ minOrderValue: null, freeShippingThreshold: 100 }));
    expect(out.get(cand[0]!)).toBe(9);
    expect(out.get(cand[1]!)).toBe(1); // towar z najmniejszym pokryciem dostaje brakujące 10 zł
  });
  it("brakuje ponad 15% — bez dopełnienia; bez pilnych odłożone", () => {
    const cand = [c(1, 5, 10, 30)];
    expect(zdBacktestApplyOrderTerms(cand, ctx({ minOrderValue: null, freeShippingThreshold: 100 })).get(cand[0]!)).toBe(0);
  });
  it("w symulacji: minimum odkłada drobne ZD — mniej zamówień, każde nie mniejsze niż minimum albo pilne", () => {
    const free = simulateZdBacktest(input(), automat(25, 1));
    const withMin = simulateZdBacktest(input({ orderTerms: { minOrderValue: 150, freeShippingThreshold: null } }), automat(25, 1));
    expect(withMin.orders).toBeLessThan(free.orders);
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

describe("werdykt najlepszych ustawień", () => {
  const reality = { zeroShare: 10, avgStock: 1000 };
  const best = { targetDays: 25, cycleDays: 7 };
  const kreator = m(12, 2000);
  it("opisuje znalezione ustawienia liczbami, bez etykiet", () => {
    const v = zdBacktestBestVerdict({ reality, best, automat: m(6, 900), pessimistic: m(10.5, 900), kreator, quality });
    expect(v.kind).toBe("works");
    expect(v.headline).toBe("Najlepiej: ZD co 7 dni, cel 25 dni");
    expect(v.reasons).toEqual([
      "Towary z zerowym stanem: 6% (naprawdę 10%).",
      "Średni zapas: 900 zł (naprawdę 1000 zł).",
      "Koszt roku: 180 zł (Kreator dziś 400 zł).",
    ]);
  });
  it("wrażliwość na opóźnienia to zdanie z liczbą, nie inny werdykt", () => {
    const v = zdBacktestBestVerdict({ reality, best: { targetDays: 30, cycleDays: 1 }, automat: m(6, 900), pessimistic: m(11.5, 900), kreator, quality });
    expect(v.kind).toBe("works");
    expect(v.headline).toBe("Najlepiej: ZD codziennie, cel 30 dni");
    expect(v.reasons.at(-1)).toBe("Gdy dostawca się spóźnia (towar dopiero z ostatnią dostawą), braki rosną do 11,5%.");
  });
  it("więcej braków niż naprawdę, ale taniej niż Kreator — nadal najlepsze do włączenia", () => {
    expect(zdBacktestBestVerdict({ reality, best, automat: m(11, 900), pessimistic: m(12, 900), kreator, quality }).kind).toBe("works");
  });
  it("więcej braków niż naprawdę przy słabo znanej marży — za mało danych, nie włączamy", () => {
    const v = zdBacktestBestVerdict({ reality, best, automat: m(11, 900), pessimistic: m(12, 900), kreator, quality: { ...quality, marginActiveShare: 60 } });
    expect(v.kind).toBe("insufficient");
    expect(v.reasons[0]).toContain("marża znana tylko dla 60%");
    expect(zdBacktestBestVerdict({ reality, best, automat: m(6, 900), pessimistic: m(7, 900), kreator, quality: { ...quality, marginActiveShare: 60 } }).kind).toBe("works");
  });
  it("więcej braków i nie taniej niż Kreator — automat nie poprawi wyniku", () => {
    const v = zdBacktestBestVerdict({ reality, best, automat: m(11, 2000), pessimistic: m(12, 2000), kreator, quality });
    expect(v.kind).toBe("fails");
    expect(v.headline).toContain("ZD co 7 dni, cel 25 dni");
  });
  it("za mało danych: mało towarów, cen albo dostaw, albo nic nie znaleziono", () => {
    const ok = { reality, best, automat: m(1, 1), pessimistic: m(1, 1), kreator };
    expect(zdBacktestBestVerdict({ ...ok, quality: { ...quality, activeSkus: 4 } }).kind).toBe("insufficient");
    expect(zdBacktestBestVerdict({ ...ok, quality: { ...quality, pricedActiveShare: 79 } }).kind).toBe("insufficient");
    expect(zdBacktestBestVerdict({ ...ok, quality: { ...quality, leadSamples: 4 } }).reasons[0]).toContain("4 zmierzonych dostaw");
    expect(zdBacktestBestVerdict({ ...ok, best: null, automat: null, quality }).kind).toBe("insufficient");
  });
});

const realityOf = (zeroShare: number, avgStock: number): ZdBacktestReality => ({
  zeroShare,
  avgStock,
  lostMargin: 0,
  cost: avgStock * 0.2,
  quarters: [{ zeroShare }, { zeroShare }, { zeroShare }, { zeroShare }],
});

const point = (over: Partial<ZdBacktestGridPoint>): ZdBacktestGridPoint => ({
  targetDays: 25,
  cycleDays: 7,
  zeroShare: 5,
  avgStock: 1000,
  orders: 50,
  medianOrder: 100,
  lostMargin: 0,
  cost: 1000,
  stableQuarters: 4,
  pessimisticZeroShare: 5,
  ...over,
});

describe("wybór najlepszych ustawień", () => {
  const r = realityOf(10, 5000);
  it("najniższy koszt wśród odpornych na opóźnienia", () => {
    const best = zdBacktestPickBest(
      [point({ cycleDays: 7, cost: 900 }), point({ cycleDays: 14, cost: 800 }), point({ cycleDays: 1, cost: 500, pessimisticZeroShare: 12 })],
      r
    );
    expect(best).toMatchObject({ cycleDays: 14, tier: "works" });
  });
  it("remis kosztu w granicach 1% rozstrzygają mniej braków", () => {
    const best = zdBacktestPickBest([point({ cycleDays: 7, cost: 1000, zeroShare: 6 }), point({ cycleDays: 5, cost: 1009, zeroShare: 3 })], r);
    expect(best?.cycleDays).toBe(5);
    expect(zdBacktestPickBest([point({ cycleDays: 7, cost: 1000, zeroShare: 6 }), point({ cycleDays: 5, cost: 1020, zeroShare: 3 })], r)?.cycleDays).toBe(7);
  });
  it("identyczny wynik dla kilku celów — wyższy cel (niższe cele silnik i tak podnosi)", () => {
    const best = zdBacktestPickBest([point({ targetDays: 10 }), point({ targetDays: 14 }), point({ targetDays: 18 })], r);
    expect(best?.targetDays).toBe(18);
  });
  it("stabilność przed kosztem: tańsze, ale trzymające w 2 kwartałach przegrywa z trzymającym we wszystkich", () => {
    const best = zdBacktestPickBest([point({ cycleDays: 7, cost: 500, stableQuarters: 2 }), point({ cycleDays: 14, cost: 900 })], r);
    expect(best?.cycleDays).toBe(14);
  });
  it("progi: wrażliwe na opóźnienia, potem najtańsze w ogóle", () => {
    expect(zdBacktestPickBest([point({ pessimisticZeroShare: 20 })], r)?.tier).toBe("delay_sensitive");
    expect(zdBacktestPickBest([point({ zeroShare: 20, pessimisticZeroShare: null, cost: 900 }), point({ zeroShare: 30, pessimisticZeroShare: null, cost: 800 })], r)).toMatchObject({
      tier: "lowest_cost",
      cost: 800,
    });
    expect(zdBacktestPickBest([], r)).toBeNull();
  });
});

describe("szukanie ustawień", () => {
  it("siatka, potem dopracowanie co 1 dzień wokół najlepszego; najlepsze = najtańsze z całości", async () => {
    const base = input();
    const steps: Array<[number, number]> = [];
    const { grid, best } = await zdBacktestSearch(base, realityOf(50, 10_000), {
      cycles: [7, 14],
      targets: [20, 30],
      onStep: (d, t) => void steps.push([d, t]),
    });
    // 4 punkty siatki + dopracowanie celu co 1 dzień
    expect(grid.length).toBeGreaterThan(4);
    expect(new Set(grid.map((g) => `${g.cycleDays}/${g.targetDays}`)).size).toBe(grid.length);
    expect(best).not.toBeNull();
    expect(best).toEqual(zdBacktestPickBest(grid, realityOf(50, 10_000)));
    // każdy punkt z brakami ≤ naprawdę ma wariant opóźnionych dostaw
    expect(grid.every((g) => g.pessimisticZeroShare != null)).toBe(true);
    expect(steps.at(-1)![0]).toBe(steps.at(-1)![1]);
    expect(steps.at(-1)![0]).toBe(grid.length * 2);
  });
  it("najlepsze na brzegu siatki — szuka dalej, do granicy zapisu (cel 180)", async () => {
    // Cel 5–6 silnik i tak podnosi do cyklu + dostawy: wynik identyczny, remis wygrywa wyższy cel = brzeg siatki.
    const { grid } = await zdBacktestSearch(input(), realityOf(50, 10_000), { cycles: [7], targets: [5, 6] });
    expect(grid.some((g) => g.targetDays === 105)).toBe(true);
    expect(grid.some((g) => g.targetDays === 180)).toBe(true);
  });
  it("cykl tylko z listy; cel dopracowany co 1 dzień wokół najlepszego", async () => {
    const r = realityOf(50, 10_000);
    const { grid, best } = await zdBacktestSearch(input(), r, { cycles: [3, 7, 14], targets: [20, 30, 40] });
    // Cykle tylko z listy (i dalszej części, gdy najlepszy wypadł na brzegu) — nigdy „co 8” czy „co 13”.
    expect(grid.every((g) => [3, 7, 14, 35, 42, 60].includes(g.cycleDays))).toBe(true);
    const has = (c: number, t: number) => grid.some((g) => g.cycleDays === c && g.targetDays === t);
    expect(has(best!.cycleDays, best!.targetDays + 1) || best!.targetDays === 180).toBe(true);
    expect(has(best!.cycleDays, best!.targetDays - 1) || best!.targetDays === 1).toBe(true);
    expect(best).toEqual(zdBacktestPickBest(grid, r));
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
