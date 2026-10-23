import { describe, expect, it } from "vitest";
import {
  zdClassifyAbcByProfit,
  zdClassifyXyz,
  zdDayDiff,
  zdEffectiveClass,
  zdSaleLinesFromEstimateDocs,
  zdWeeklySales,
} from "./zd-sku-class";

const AS_OF = "2026-10-01";
/** Data `days` dni przed AS_OF. */
const ago = (days: number) => new Date(Date.parse(`${AS_OF}T12:00:00Z`) - days * 86_400_000).toISOString().slice(0, 10);

describe("zd-sku-class — tygodnie", () => {
  it("tydzień 0 = 7 dni przed dniem przeliczenia; dzień przeliczenia i zwroty pomijane", () => {
    const { weeks, firstSale } = zdWeeklySales(
      [
        { date: ago(1), qty: 2 },
        { date: ago(7), qty: 3 },
        { date: ago(8), qty: 5 },
        { date: ago(0), qty: 100 },
        { date: ago(3), qty: -4 },
        { date: ago(364), qty: 1 },
        { date: ago(365), qty: 9 },
      ],
      AS_OF
    );
    expect(weeks).toHaveLength(52);
    expect(weeks[0]).toBe(5);
    expect(weeks[1]).toBe(5);
    expect(weeks[51]).toBe(1);
    expect(weeks.reduce((a, b) => a + b, 0)).toBe(11);
    // Sprzedaż sprzed 52 tygodni nie wchodzi do tygodni, ale wyznacza pierwszą sprzedaż.
    expect(firstSale).toBe(ago(365));
  });

  it("linie estimate: tylko składnik sprzedazOkres", () => {
    const lines = zdSaleLinesFromEstimateDocs([
      { wSkladnik: "sprzedazOkres", rola: "fs", dok_DataWyst: "2026-09-02T00:00:00", ob_Ilosc: 2 },
      { wSkladnik: "info", rola: "zk", dok_DataWyst: "2026-09-03T00:00:00", ob_Ilosc: 50 },
      { wSkladnik: "sprzedazOkres", rola: "pa", dok_DataWyst: null, ob_Ilosc: 1 },
    ]);
    expect(lines).toEqual([{ date: "2026-09-02", qty: 2 }]);
  });

  it("różnica dni bez przesunięcia strefy", () => {
    expect(zdDayDiff("2026-03-28", "2026-03-30")).toBe(2);
  });
});

describe("zd-sku-class — XYZ", () => {
  const steady = (q: number) => new Array(52).fill(q);

  it("równa sprzedaż co tydzień → X, CV 0", () => {
    expect(zdClassifyXyz({ weeks: steady(4), firstSale: ago(400), asOf: AS_OF })).toEqual({
      xyz: "X",
      cv: 0,
      activeWeeks: 52,
    });
  });

  it("CV na granicach: tuż ponad 0,5 → Y, 1,0 → Y, powyżej 1 → Z", () => {
    // Naprzemiennie a, b: średnia m, σ próbkowe = |a−b|/2 · √(52/51).
    const alt = (a: number, b: number) => Array.from({ length: 52 }, (_, i) => (i % 2 ? a : b));
    const k = Math.sqrt(52 / 51);
    const cvFor = (d: number) => alt(10 + d, 10 - d);
    expect(zdClassifyXyz({ weeks: cvFor(4.9 / k), firstSale: ago(400), asOf: AS_OF }).xyz).toBe("X");
    expect(zdClassifyXyz({ weeks: cvFor(5.01 / k), firstSale: ago(400), asOf: AS_OF }).xyz).toBe("Y");
    expect(zdClassifyXyz({ weeks: cvFor(10 / k), firstSale: ago(400), asOf: AS_OF }).cv).toBeCloseTo(1, 10);
    expect(zdClassifyXyz({ weeks: cvFor(9.99 / k), firstSale: ago(400), asOf: AS_OF }).xyz).toBe("Y");
    const spiky = new Array(52).fill(1);
    spiky[3] = 200;
    expect(zdClassifyXyz({ weeks: spiky, firstSale: ago(400), asOf: AS_OF }).xyz).toBe("Z");
  });

  it("sprzedaż w mniej niż 13 tygodniach → Z mimo niskiego CV", () => {
    const weeks = new Array(52).fill(0);
    for (let i = 0; i < 12; i++) weeks[i * 4] = 5;
    expect(zdClassifyXyz({ weeks, firstSale: ago(300), asOf: AS_OF })).toMatchObject({ xyz: "Z", activeWeeks: 12 });
    weeks[1] = 5;
    expect(zdClassifyXyz({ weeks, firstSale: ago(300), asOf: AS_OF }).activeWeeks).toBe(13);
  });

  it("pierwsza sprzedaż < 13 tygodni temu → N; dokładnie 13 tygodni → już nie N", () => {
    const weeks = new Array(52).fill(0);
    weeks[0] = 3;
    expect(zdClassifyXyz({ weeks, firstSale: ago(90), asOf: AS_OF }).xyz).toBe("N");
    expect(zdClassifyXyz({ weeks, firstSale: ago(91), asOf: AS_OF }).xyz).toBe("Z");
  });

  it("brak sprzedaży → Z bez CV", () => {
    expect(zdClassifyXyz({ weeks: steady(0), firstSale: null, asOf: AS_OF })).toEqual({
      xyz: "Z",
      cv: null,
      activeWeeks: 0,
    });
  });
});

describe("zd-sku-class — ABC wg zysku", () => {
  it("A do 80% skumulowanego zysku (towar przekraczający próg jeszcze A), B do 95%, reszta C", () => {
    const abc = zdClassifyAbcByProfit([
      { twId: 1, profit: 50 },
      { twId: 2, profit: 31 },
      { twId: 3, profit: 10 },
      { twId: 4, profit: 5 },
      { twId: 5, profit: 4 },
    ]);
    // Przed: 1 → 0%, 2 → 50%, 3 → 81%, 4 → 91%, 5 → 96%.
    expect([...abc.entries()].sort((a, b) => a[0] - b[0])).toEqual([
      [1, "A"],
      [2, "A"],
      [3, "B"],
      [4, "B"],
      [5, "C"],
    ]);
  });

  it("zysk ≤ 0 → C i nie liczy się do sumy", () => {
    const abc = zdClassifyAbcByProfit([
      { twId: 7, profit: -20 },
      { twId: 8, profit: 0 },
      { twId: 9, profit: 1 },
    ]);
    expect(abc.get(7)).toBe("C");
    expect(abc.get(8)).toBe("C");
    expect(abc.get(9)).toBe("A");
  });

  it("równy zysk — kolejność po id, wynik stały", () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({ twId: 10 - i, profit: 1 }));
    const abc = zdClassifyAbcByProfit(rows);
    expect([1, 2, 3, 4, 5, 6, 7, 8].map((id) => abc.get(id))).toEqual(new Array(8).fill("A"));
    // Przed 9: 80% → B; przed 10: 90% → B.
    expect(abc.get(9)).toBe("B");
    expect(abc.get(10)).toBe("B");
  });
});

describe("zd-sku-class — nadpisanie", () => {
  it("nadpisanie wygrywa, brak nadpisania zostawia policzoną", () => {
    expect(zdEffectiveClass({ abc: "C", xyz: "Z", overrideAbc: "A", overrideXyz: null })).toEqual({ abc: "A", xyz: "Z" });
  });
});
