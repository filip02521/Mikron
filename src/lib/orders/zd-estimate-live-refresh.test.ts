import { describe, expect, it } from "vitest";
import {
  collectMissingZdPairPartnerTwIds,
  refreshZdEstimateLinesWithPairs,
} from "@/lib/orders/zd-estimate-live-refresh";
import {
  mapZdEstimateLineToManual,
  type ManualZdEstimateLine,
} from "@/lib/orders/zd-estimate-manual";
import { resolveOrderQtyForLine } from "@/lib/orders/zd-estimate-packaging";

function baseLine(
  twId: number,
  overrides: Partial<ManualZdEstimateLine> = {}
): ManualZdEstimateLine {
  return {
    tw_Id: twId,
    tw_Symbol: `S${twId}`,
    tw_Nazwa: `N${twId}`,
    tw_IdGrupa: 1,
    grt_Nazwa: "G",
    tw_Stan: 10,
    tw_StanRez: 0,
    dostepne: 10,
    sprzedazOkres: 20,
    sprzedazDziennie: 1,
    celZapasu: 30,
    celZapasuTracked: 30,
    salesTrackDelta: 0,
    salesTrackReasons: [],
    salesTrackConfidence: 0,
    salesTrackQtyReview: false,
    salesTrackHeldExtraQty: 0,
    salesTrackAllowedExtraQty: 0,
    otwarteZkBezRez: 0,
    otwarteZkZarezerwowane: 0,
    otwarteZd: 0,
    doZamowieniaApi: 0,
    doZamowieniaReczne: 20,
    wkladZk: 0,
    pair: null,
    ...overrides,
  };
}

describe("collectMissingZdPairPartnerTwIds", () => {
  it("returns missing side when only pack present", () => {
    expect(
      collectMissingZdPairPartnerTwIds(
        [{ tw_Id: 100 }],
        [{ packTwId: 100, pieceTwId: 200, unitsPerPack: 10 }]
      )
    ).toEqual([200]);
  });

  it("empty when both present", () => {
    expect(
      collectMissingZdPairPartnerTwIds(
        [{ tw_Id: 100 }, { tw_Id: 200 }],
        [{ packTwId: 100, pieceTwId: 200, unitsPerPack: 10 }]
      )
    ).toEqual([]);
  });
});

describe("refreshZdEstimateLinesWithPairs", () => {
  it("applies pack/piece roles and zeros piece qty", () => {
    const { lines, missingPartnerTwIds } = refreshZdEstimateLinesWithPairs({
      linesBase: [
        baseLine(100, { sprzedazOkres: 0, dostepne: 0 }),
        baseLine(200, { sprzedazOkres: 40, dostepne: 5 }),
      ],
      pairs: [{ packTwId: 100, pieceTwId: 200, unitsPerPack: 10 }],
      options: { dniZapasu: 30 },
    });
    expect(missingPartnerTwIds).toEqual([]);
    const pack = lines.find((l) => l.tw_Id === 100);
    const piece = lines.find((l) => l.tw_Id === 200);
    expect(pack?.pair?.role).toBe("pack");
    expect(piece?.pair?.role).toBe("piece");
    expect(piece?.doZamowieniaReczne).toBe(0);
    expect((pack?.doZamowieniaReczne ?? 0) > 0).toBe(true);
  });

  it("clears pair meta when pairs empty", () => {
    const { lines } = refreshZdEstimateLinesWithPairs({
      linesBase: [baseLine(1)],
      pairs: [],
      options: { dniZapasu: 30 },
    });
    expect(lines[0]?.pair).toBeNull();
  });

  it("BOM expand then pairs from base", () => {
    const { lines, missingBomTwIds } = refreshZdEstimateLinesWithPairs({
      linesBase: [
        baseLine(1, { sprzedazOkres: 5, dostepne: 0, doZamowieniaReczne: 5 }),
        baseLine(3, { sprzedazOkres: 1, dostepne: 0 }),
        baseLine(4, { sprzedazOkres: 2, dostepne: 0 }),
      ],
      pairs: [],
      boms: [
        {
          parentTwId: 4,
          stockAsCover: false,
          components: [{ componentTwId: 1, qtyPerParent: 1 }],
        },
      ],
      options: { dniZapasu: 30, dniOkresu: 30, salesTrack: false },
    });
    expect(missingBomTwIds).toEqual([]);
    expect(lines.find((l) => l.tw_Id === 4)?.bom?.role).toBe("assembled_parent");
    expect(lines.find((l) => l.tw_Id === 1)?.sprzedazOkres).toBe(7);
  });

  it("przekazuje historyByTwId — history_slow zostaje po refresh", () => {
    const linkedAt = new Date(Date.now() - 90 * 86400000).toISOString();
    const linesBase = [
      baseLine(100, { sprzedazOkres: 0, dostepne: 0 }),
      baseLine(200, { sprzedazOkres: 90, dostepne: 0 }),
    ];
    const pairs = [{ packTwId: 100, pieceTwId: 200, unitsPerPack: 100 }];
    const without = refreshZdEstimateLinesWithPairs({
      linesBase,
      pairs,
      options: {
        dniZapasu: 30,
        dniOkresu: 30,
        salesTrack: true,
        salesTrackCuts: true,
      },
    });
    const withHist = refreshZdEstimateLinesWithPairs({
      linesBase,
      pairs,
      options: {
        dniZapasu: 30,
        dniOkresu: 30,
        salesTrack: true,
        salesTrackCuts: true,
        historyByTwId: new Map([
          [100, { lastOrderedQty: 500, linkedAt }],
        ]),
      },
    });
    const a = without.lines.find((l) => l.tw_Id === 100)!;
    const b = withHist.lines.find((l) => l.tw_Id === 100)!;
    expect(b.celZapasuTracked).toBeLessThanOrEqual(a.celZapasuTracked);
  });

  it("zmiana N (Mode A) rematuje qty mimo starego celTracked", () => {
    const stale = baseLine(1, {
      celZapasu: 40,
      celZapasuTracked: 40,
      dostepne: 10,
      otwarteZd: 2,
      doZamowieniaReczne: 28,
      doZamowieniaApi: 77,
      sprzedazOkres: 0,
      sprzedazDziennie: 0,
    });
    const { lines } = refreshZdEstimateLinesWithPairs({
      linesBase: [stale],
      pairs: [],
      options: {
        dniZapasu: 30,
        salesTrack: false,
        packagingByTwId: new Map([
          [1, { unitsPerPackage: 10, documentUnitMode: "packages" }],
        ]),
      },
    });
    const rematted = lines[0]!;
    const expected = mapZdEstimateLineToManual(stale, {
      salesTrack: false,
      unitsPerPackage: 10,
      documentUnitMode: "packages",
      dniZapasu: 30,
    });
    expect(rematted.doZamowieniaReczne).toBe(10);
    expect(rematted.doZamowieniaReczne).toBe(expected.doZamowieniaReczne);
    expect(rematted.doZamowieniaApi).toBe(77);
    const q = resolveOrderQtyForLine(rematted, {
      unitsPerPackage: 10,
      documentUnitMode: "packages",
    });
    expect(q.piecesNeeded).toBe(10);
    expect(q.zdUnits).toBe(1);
  });

  it("przełączenie Mode A → B rematuje otwarteZd bez × N", () => {
    const staleFromA = baseLine(1, {
      celZapasu: 40,
      celZapasuTracked: 40,
      dostepne: 10,
      otwarteZd: 10,
      doZamowieniaReczne: 0, // A: 10 op. × 5 = 50 szt cover
      sprzedazOkres: 0,
      sprzedazDziennie: 0,
    });
    const { lines } = refreshZdEstimateLinesWithPairs({
      linesBase: [staleFromA],
      pairs: [],
      options: {
        dniZapasu: 30,
        salesTrack: false,
        packagingByTwId: new Map([
          [1, { unitsPerPackage: 5, documentUnitMode: "pieces_multiple" }],
        ]),
      },
    });
    expect(lines[0]?.doZamowieniaReczne).toBe(20);
    const q = resolveOrderQtyForLine(lines[0]!, {
      unitsPerPackage: 5,
      documentUnitMode: "pieces_multiple",
    });
    expect(q.piecesNeeded).toBe(20);
    expect(q.zdUnits).toBe(20);
  });

  it("sales-track: nowy N zmienia cover → Create nie liczy ze starym celem", () => {
    const raw = baseLine(1, {
      celZapasu: 60,
      celZapasuTracked: 60,
      dostepne: 10,
      otwarteZd: 5,
      sprzedazOkres: 50,
      sprzedazDziennie: 2,
      doZamowieniaReczne: 45,
    });
    const pack = {
      unitsPerPackage: 10,
      documentUnitMode: "packages" as const,
    };
    const staleTracked = refreshZdEstimateLinesWithPairs({
      linesBase: [raw],
      pairs: [],
      options: { dniZapasu: 30, dniOkresu: 30, salesTrack: true },
    }).lines[0]!;
    const rematted = refreshZdEstimateLinesWithPairs({
      linesBase: [raw],
      pairs: [],
      options: {
        dniZapasu: 30,
        dniOkresu: 30,
        salesTrack: true,
        packagingByTwId: new Map([[1, pack]]),
      },
    }).lines[0]!;

    expect(staleTracked.celZapasuTracked).toBeGreaterThan(
      rematted.celZapasuTracked
    );

    const wrongCreate = resolveOrderQtyForLine(staleTracked, pack);
    const rightCreate = resolveOrderQtyForLine(rematted, pack);
    expect(wrongCreate.piecesNeeded).not.toBe(rightCreate.piecesNeeded);
    expect(rightCreate.piecesNeeded).toBe(rematted.doZamowieniaReczne);
  });

  it("para nadpisuje solo — zmiana N opakowania pack SKU nie psuje merge", () => {
    const withN2 = refreshZdEstimateLinesWithPairs({
      linesBase: [
        baseLine(100, { sprzedazOkres: 0, dostepne: 0 }),
        baseLine(200, { sprzedazOkres: 40, dostepne: 5 }),
      ],
      pairs: [{ packTwId: 100, pieceTwId: 200, unitsPerPack: 10 }],
      options: {
        dniZapasu: 30,
        packagingByTwId: new Map([
          [100, { unitsPerPackage: 2, documentUnitMode: "pieces_multiple" }],
        ]),
      },
    });
    const withN99 = refreshZdEstimateLinesWithPairs({
      linesBase: [
        baseLine(100, { sprzedazOkres: 0, dostepne: 0 }),
        baseLine(200, { sprzedazOkres: 40, dostepne: 5 }),
      ],
      pairs: [{ packTwId: 100, pieceTwId: 200, unitsPerPack: 10 }],
      options: {
        dniZapasu: 30,
        packagingByTwId: new Map([
          [100, { unitsPerPackage: 99, documentUnitMode: "packages" }],
        ]),
      },
    });
    const packA = withN2.lines.find((l) => l.tw_Id === 100)!;
    const packB = withN99.lines.find((l) => l.tw_Id === 100)!;
    const pieceA = withN2.lines.find((l) => l.tw_Id === 200)!;
    expect(packA.pair?.role).toBe("pack");
    expect(pieceA.doZamowieniaReczne).toBe(0);
    expect(packA.doZamowieniaReczne).toBe(packB.doZamowieniaReczne);
    expect(packA.celZapasuTracked).toBe(packB.celZapasuTracked);
  });
});
