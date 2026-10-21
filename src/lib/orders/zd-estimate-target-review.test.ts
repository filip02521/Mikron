import { describe, expect, it } from "vitest";
import { computeSalesTrackedCel } from "@/lib/orders/zd-estimate-sales-track";
import { buildManualZdEstimateResult, zdEstimateWindowDays } from "@/lib/orders/zd-estimate-manual";

describe("cel zapasu - niezależność od długości okna sprzedaży", () => {
  const at = (sprzedazOkres: number, dniOkresu: number, celZapasu: number, dostepne: number) =>
    computeSalesTrackedCel({
      celZapasu,
      sprzedazOkres,
      sprzedazDziennie: sprzedazOkres / dniOkresu,
      dostepne,
      dniZapasu: 30,
      dniOkresu,
    }).celTracked;

  it("to samo tempo 1 szt./d: okno 30 i 90 dni dają ten sam cel", () => {
    expect(at(90, 90, 30, 27)).toBeCloseTo(at(30, 30, 30, 27), 6);
    expect(at(180, 180, 30, 27)).toBeCloseTo(at(30, 30, 30, 27), 6);
  });

  it("krótkie okno: stan poniżej celu nie dostaje cięcia „niski sell-through”", () => {
    const r = computeSalesTrackedCel({
      celZapasu: 60,
      sprzedazOkres: 28,
      sprzedazDziennie: 2,
      dostepne: 52,
      dniZapasu: 30,
      dniOkresu: 14,
    });
    expect(r.reasons).not.toContain("low_sell_through");
  });
});

describe("okno sprzedaży bez dniOkresu z API", () => {
  it("liczone z dat, włącznie", () => {
    expect(zdEstimateWindowDays({ dataOd: "2026-09-21", dataDo: "2026-10-20" })).toBe(30);
    expect(zdEstimateWindowDays({ dniOkresu: 45, dataOd: "2026-09-21", dataDo: "2026-10-20" })).toBe(45);
    expect(zdEstimateWindowDays({})).toBeNull();
  });

  it("para paczka↔sztuka liczy tempo z okna, nie z dni zapasu", () => {
    const params = { dniZapasu: 60, dataOd: "2026-09-21", dataDo: "2026-10-20", zapasMin: 0 };
    const res = buildManualZdEstimateResult(
      params,
      [
        { tw_Id: 1, tw_Symbol: "KARTON", sprzedazOkres: 0, dostepne: 0, celZapasu: 0 },
        { tw_Id: 2, tw_Symbol: "SZT", sprzedazOkres: 30, dostepne: 0, celZapasu: 0 },
      ],
      { salesTrack: false, productPairs: [{ packTwId: 1, pieceTwId: 2, unitsPerPack: 10 }] }
    );
    expect(res.pozycje.find((p) => p.tw_Id === 1)!.celZapasuTracked).toBe(60);
  });
});

describe("pary i składy - niedobory nie znikają", () => {
  it("minimum stanów ustawione na sztuce pary działa na paczce", () => {
    const res = buildManualZdEstimateResult(
      { dniZapasu: 30, dniOkresu: 30, zapasMin: 0 },
      [
        { tw_Id: 1, tw_Symbol: "KARTON", sprzedazOkres: 0, dostepne: 0, celZapasu: 0 },
        { tw_Id: 2, tw_Symbol: "SZT", sprzedazOkres: 0, dostepne: 0, celZapasu: 0 },
      ],
      {
        salesTrack: false,
        productPairs: [{ packTwId: 1, pieceTwId: 2, unitsPerPack: 10 }],
        minStockByTwId: new Map([[2, 50]]),
      }
    );
    expect(res.pozycje.find((p) => p.tw_Id === 1)!.doZamowieniaReczne).toBe(50);
  });

  it("rezerwacje ponad stan zestawu „Składamy” schodzą na składniki", () => {
    const res = buildManualZdEstimateResult(
      { dniZapasu: 30, dniOkresu: 30, zapasMin: 0 },
      [
        { tw_Id: 100, tw_Symbol: "KIT", sprzedazOkres: 0, dostepne: -5, celZapasu: 0 },
        { tw_Id: 1, tw_Symbol: "A", sprzedazOkres: 0, dostepne: 0, celZapasu: 0 },
      ],
      {
        salesTrack: false,
        productBoms: [
          {
            parentTwId: 100,
            stockAsCover: true,
            demandAllocation: "explode",
            purchaseTarget: "components",
            components: [{ componentTwId: 1, qtyPerParent: 2 }],
          },
        ],
      }
    );
    expect(res.pozycje.find((p) => p.tw_Id === 1)!.doZamowieniaReczne).toBe(10);
  });
});

describe("Komplet ze sprzedaży składników - luźne sztuki na stanie", () => {
  const run = (looseA: number, looseB: number) =>
    buildManualZdEstimateResult(
      { dniZapasu: 30, dniOkresu: 30, zapasMin: 0 },
      [
        { tw_Id: 300, tw_Symbol: "MIX", sprzedazOkres: 0, dostepne: 0, celZapasu: 0 },
        { tw_Id: 1, tw_Symbol: "A", sprzedazOkres: 72, dostepne: looseA, celZapasu: 72 },
        { tw_Id: 2, tw_Symbol: "B", sprzedazOkres: 18, dostepne: looseB, celZapasu: 18 },
      ],
      {
        salesTrack: false,
        productBoms: [
          {
            parentTwId: 300,
            stockAsCover: false,
            demandAllocation: "separate",
            purchaseTarget: "kit_from_components",
            components: [
              { componentTwId: 1, qtyPerParent: 6 },
              { componentTwId: 2, qtyPerParent: 6 },
            ],
          },
        ],
      }
    ).pozycje.find((p) => p.tw_Id === 300)!.doZamowieniaReczne;

  it("bez luźnych sztuk: komplety ze sprzedaży najmocniejszego koloru", () => {
    expect(run(0, 0)).toBe(12);
  });

  it("luźne sztuki pokrywają popyt - komplety nie są dokładane", () => {
    expect(run(80, 40)).toBe(0);
  });

  it("częściowe pokrycie: 36 szt. A na stanie = 6 kompletów mniej", () => {
    expect(run(36, 0)).toBe(6);
  });
});

describe("zapas minimalny - twarda podłoga celu", () => {
  it("cięcie za grube pokrycie nie schodzi poniżej zapasMin", () => {
    const res = buildManualZdEstimateResult(
      { dniZapasu: 30, dniOkresu: 30, zapasMin: 10 },
      // Rzadka sprzedaż i duży stan → cięcia; cel z API = 1 + 10.
      [{ tw_Id: 1, tw_Symbol: "A", sprzedazOkres: 1, sprzedazDziennie: 1 / 30, dostepne: 5, celZapasu: 11 }],
      { salesTrack: true, salesTrackCuts: true, historyByTwId: new Map([[1, { lastOrderedQty: 100, linkedAt: new Date(Date.now() - 40 * 86_400_000).toISOString() }]]) }
    );
    const a = res.pozycje[0]!;
    expect(a.salesTrackReasons.length).toBeGreaterThan(0);
    expect(a.celZapasuTracked).toBeGreaterThanOrEqual(10);
    expect(a.doZamowieniaReczne).toBe(5);
  });

  it("para: podłoga w sztukach pary", () => {
    const res = buildManualZdEstimateResult(
      { dniZapasu: 30, dniOkresu: 30, zapasMin: 10 },
      [
        { tw_Id: 1, tw_Symbol: "KARTON", sprzedazOkres: 0, dostepne: 0, celZapasu: 0 },
        { tw_Id: 2, tw_Symbol: "SZT", sprzedazOkres: 1, dostepne: 5, celZapasu: 0 },
      ],
      {
        salesTrack: true,
        salesTrackCuts: true,
        productPairs: [{ packTwId: 1, pieceTwId: 2, unitsPerPack: 10 }],
        historyByTwId: new Map([[1, { lastOrderedQty: 100, linkedAt: new Date(Date.now() - 40 * 86_400_000).toISOString() }]]),
      }
    );
    expect(res.pozycje.find((p) => p.tw_Id === 1)!.celZapasuTracked).toBeGreaterThanOrEqual(10);
  });
});
