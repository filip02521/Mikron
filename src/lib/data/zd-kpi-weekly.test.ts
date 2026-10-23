import { describe, expect, it } from "vitest";
import {
  zdKpiFinalValue,
  zdKpiHumanCorrection,
  zdKpiLastZdPricePerPiece,
  zdKpiMinima,
  zdKpiOosA,
  zdKpiStock,
  zdKpiWeekStart,
  type ZdKpiProposal,
} from "./zd-kpi-weekly";

describe("zd-kpi-weekly — tydzień", () => {
  it("poniedziałek → poprzedni poniedziałek; niedziela → poniedziałek tygodnia przed", () => {
    expect(zdKpiWeekStart("2026-10-26")).toBe("2026-10-19"); // pn
    expect(zdKpiWeekStart("2026-10-25")).toBe("2026-10-12"); // nd
    expect(zdKpiWeekStart("2026-10-28")).toBe("2026-10-19"); // śr
  });
});

describe("zd-kpi-weekly — braki A", () => {
  it("liczy tylko dni towarów A; dostępne ≤ 0 = brak", () => {
    const oos = zdKpiOosA(
      [
        { twId: 1, available: 0 },
        { twId: 1, available: 3 },
        { twId: 2, available: -1 },
        { twId: 2, available: 5 },
        { twId: 9, available: 0 },
      ],
      new Set([1, 2])
    );
    expect(oos).toEqual({ pct: 50, zeroDays: 2, skuDays: 4 });
  });

  it("bez historii stanów — brak wyniku, nie 0%", () => {
    expect(zdKpiOosA([], new Set([1])).pct).toBeNull();
  });
});

describe("zd-kpi-weekly — rotacja i martwy zapas", () => {
  it("wartość / dzienny koszt (90 dni), per klasa; martwy = na stanie bez sprzedaży 180 dni", () => {
    const { rotation, deadStock } = zdKpiStock([
      { twId: 1, abc: "A", stock: 10, price: 9, cost: 900, soldRecently: true },
      { twId: 2, abc: "C", stock: 4, price: 25, cost: 0, soldRecently: false },
      { twId: 3, abc: "C", stock: 0, price: 50, cost: 90, soldRecently: true },
      { twId: 4, abc: "B", stock: 2, price: null, cost: 0, soldRecently: false },
    ]);
    // Zapas 90 + 100 = 190; koszt 990 / 90 = 11 dziennie → 17,3 dnia.
    expect(rotation.stockValue).toBe(190);
    expect(rotation.dailyCost).toBe(11);
    expect(rotation.days).toBe(17.3);
    expect(rotation.byAbc.A).toEqual({ days: 9, stockValue: 90, dailyCost: 10 });
    expect(rotation.byAbc.C).toEqual({ days: 100, stockValue: 100, dailyCost: 1 });
    expect(rotation.byAbc.B).toEqual({ days: null, stockValue: 0, dailyCost: 0 });
    expect(rotation.unpriced).toBe(1);
    // Towar 4 bez ceny liczy się jako martwy (sztuka), ale z wartością 0.
    expect(deadStock).toEqual({ value: 100, skus: 2 });
  });
});

const proposal = (over: Partial<ZdKpiProposal>): ZdKpiProposal => ({
  status: "accepted",
  lines: [
    // 2 paczki po 10 szt. × 1,5 zł → 15 zł za paczkę.
    { twId: 1, zdUnits: 2, pieces: 20, priceNet: 1.5 },
    { twId: 2, zdUnits: 5, pieces: 5, priceNet: 10 },
    { twId: 3, zdUnits: 1, pieces: 1, priceNet: null },
  ],
  finalLines: { "1": 2, "2": 3, "3": 1 },
  ...over,
});

describe("zd-kpi-weekly — korekta człowieka", () => {
  it("wartość zmienionych jednostek / wartość propozycji; dopisane pozycje osobno", () => {
    const hc = zdKpiHumanCorrection([
      proposal({ finalLines: { "1": 2, "2": 3, "3": 1, "99": 4 } }),
      proposal({ status: "rejected" }),
      proposal({ status: "pending", finalLines: null }),
    ]);
    // Propozycja 30 + 50 = 80 zł, zmiana 2 × 10 = 20 zł → 25%.
    expect(hc).toEqual({ pct: 25, changedValue: 20, proposalValue: 80, proposals: 1, addedLines: 1 });
  });

  it("usunięta pozycja (brak w final_lines) = cała wartość zmieniona", () => {
    expect(zdKpiHumanCorrection([proposal({ finalLines: { "2": 5 } })]).changedValue).toBe(30);
  });
});

describe("zd-kpi-weekly — minima", () => {
  it("% odłożonych i % ZD ≥ minimum (wartość po decyzji)", () => {
    const list = [
      proposal({}), // 30 + 30 = 60 zł
      proposal({ finalLines: { "1": 2, "2": 5 } }), // 80 zł
      proposal({ status: "deferred", finalLines: null }),
      proposal({ status: "expired", finalLines: null }),
      // Odłożona, potem wygaszona przez nową propozycję — dalej liczy się jako odłożona.
      proposal({ status: "expired", deferred: true, finalLines: null }),
    ];
    expect(zdKpiFinalValue(list[0]!)).toBe(60);
    expect(zdKpiMinima(list, 80)).toEqual({
      proposals: 5,
      deferred: 2,
      deferredPct: 40,
      accepted: 2,
      acceptedAboveMin: 1,
      aboveMinPct: 50,
      minOrderValue: 80,
    });
  });

  it("dostawca bez minimum — brak % minimum", () => {
    expect(zdKpiMinima([proposal({})], null).aboveMinPct).toBeNull();
  });
});

describe("zd-kpi-weekly — cena z ostatniego ZD za sztukę", () => {
  it("opakowanie w trybie paczek dzieli cenę; tryb wielokrotności sztuk i brak opakowania zostawia; para wygrywa", () => {
    const m = zdKpiLastZdPricePerPiece(
      [
        { twId: 1, priceNet: 100 },
        { twId: 2, priceNet: 100 },
        { twId: 3, priceNet: 100 },
        { twId: 4, priceNet: 60 },
        { twId: 5, priceNet: 0 },
      ],
      [
        { subiektTwId: 1, unitsPerPackage: 10, documentUnitMode: "packages" },
        { subiektTwId: 2, unitsPerPackage: 10, documentUnitMode: "pieces_multiple" },
        { subiektTwId: 4, unitsPerPackage: 2, documentUnitMode: "pieces_multiple" },
      ],
      [{ packTwId: 4, unitsPerPack: 6 }]
    );
    expect(m.get(1)).toBe(10);
    expect(m.get(2)).toBe(100);
    expect(m.get(3)).toBe(100);
    expect(m.get(4)).toBe(10);
    // Cena 0 = brak ceny → towar liczony w „bez ceny”.
    expect(m.has(5)).toBe(false);
  });
});
