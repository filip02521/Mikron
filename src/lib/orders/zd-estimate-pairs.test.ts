import { describe, expect, it } from "vitest";
import {
  indexZdProductPairs,
  pairCoverPieces,
  pairSalesPieces,
  piecesToPackUnits,
  pairQtyToPieces,
} from "./zd-product-pair-units";
import { applyZdEstimatePairs, mergePairHistoryForCut } from "./zd-estimate-pairs";
import type { ManualZdEstimateLine } from "./zd-estimate-manual";

function line(
  partial: Partial<ManualZdEstimateLine> & {
    tw_Id: number;
    tw_Symbol: string;
  }
): ManualZdEstimateLine {
  return {
    tw_Nazwa: partial.tw_Nazwa ?? partial.tw_Symbol,
    tw_IdGrupa: null,
    grt_Nazwa: "—",
    tw_Stan: partial.dostepne ?? 0,
    tw_StanRez: 0,
    dostepne: 0,
    sprzedazOkres: 0,
    sprzedazDziennie: 0,
    celZapasu: 0,
    celZapasuTracked: 0,
    salesTrackDelta: 0,
    salesTrackReasons: [],
    otwarteZkBezRez: 0,
    otwarteZkZarezerwowane: 0,
    otwarteZd: 0,
    doZamowieniaApi: 0,
    doZamowieniaReczne: 0,
    wkladZk: 0,
    ...partial,
  };
}

describe("zd-product-pair-units", () => {
  it("pack qty → sztuki", () => {
    expect(pairQtyToPieces(2, "pack", 100)).toBe(200);
    expect(pairQtyToPieces(50, "piece", 100)).toBe(50);
  });

  it("pieces → paczki ceil", () => {
    expect(piecesToPackUnits(1, 100)).toBe(1);
    expect(piecesToPackUnits(100, 100)).toBe(1);
    expect(piecesToPackUnits(101, 100)).toBe(2);
  });

  it("pairCover / pairSales", () => {
    expect(
      pairCoverPieces({
        pieceDostepne: 10,
        packDostepne: 2,
        unitsPerPack: 100,
        packOtwarteZd: 1,
      })
    ).toBe(10 + 200 + 100);
    expect(
      pairSalesPieces({
        pieceSprzedazOkres: 40,
        packSprzedazOkres: 1,
        unitsPerPack: 100,
      })
    ).toBe(140);
  });

  it("indexuje pack i piece", () => {
    const idx = indexZdProductPairs([
      { packTwId: 10, pieceTwId: 20, unitsPerPack: 100 },
    ]);
    expect(idx.get(10)?.role).toBe("pack");
    expect(idx.get(20)?.role).toBe("piece");
  });
});

describe("applyZdEstimatePairs", () => {
  const pair = { packTwId: 10, pieceTwId: 20, unitsPerPack: 100 };

  it("S1/S3: sprzedaż sztuk podnosi Do ZD na paczce", () => {
    const lines = [
      line({
        tw_Id: 10,
        tw_Symbol: "PACK",
        dostepne: 0,
        sprzedazOkres: 0,
        otwarteZd: 0,
      }),
      line({
        tw_Id: 20,
        tw_Symbol: "PC",
        dostepne: 0,
        sprzedazOkres: 200,
        otwarteZd: 0,
      }),
    ];
    const out = applyZdEstimatePairs(lines, [pair], {
      dniZapasu: 30,
      dniOkresu: 30,
      zapasMin: 0,
      salesTrack: false,
    });
    const pack = out.find((l) => l.tw_Id === 10)!;
    const piece = out.find((l) => l.tw_Id === 20)!;
    expect(piece.doZamowieniaReczne).toBe(0);
    expect(pack.pair?.sprzedazSzt).toBe(200);
    // cel = 200/30*30 = 200; cover 0 → 200 szt needed
    expect(pack.doZamowieniaReczne).toBe(200);
  });

  it("S9: otwarte ZD paczek w cover", () => {
    const lines = [
      line({
        tw_Id: 10,
        tw_Symbol: "PACK",
        dostepne: 0,
        sprzedazOkres: 0,
        otwarteZd: 2, // 2 paczki = 200 szt
      }),
      line({
        tw_Id: 20,
        tw_Symbol: "PC",
        dostepne: 0,
        sprzedazOkres: 200,
      }),
    ];
    const out = applyZdEstimatePairs(lines, [pair], {
      dniZapasu: 30,
      dniOkresu: 30,
      salesTrack: false,
    });
    const pack = out.find((l) => l.tw_Id === 10)!;
    expect(pack.pair?.coverSzt).toBe(200);
    expect(pack.doZamowieniaReczne).toBe(0);
  });

  it("B1: stan na paczkach pokrywa sztuki", () => {
    const lines = [
      line({ tw_Id: 10, tw_Symbol: "PACK", dostepne: 5, sprzedazOkres: 0 }),
      line({ tw_Id: 20, tw_Symbol: "PC", dostepne: 0, sprzedazOkres: 100 }),
    ];
    const out = applyZdEstimatePairs(lines, [pair], {
      dniZapasu: 30,
      dniOkresu: 30,
      salesTrack: false,
    });
    const pack = out.find((l) => l.tw_Id === 10)!;
    expect(pack.pair?.coverSzt).toBe(500);
    expect(pack.doZamowieniaReczne).toBe(0);
  });

  it("B6: piece wykluczony — sprzedaż nadal w popycie, piece qty 0", () => {
    const lines = [
      line({ tw_Id: 10, tw_Symbol: "PACK", dostepne: 0, sprzedazOkres: 0 }),
      line({ tw_Id: 20, tw_Symbol: "PC", dostepne: 0, sprzedazOkres: 90 }),
    ];
    const out = applyZdEstimatePairs(lines, [pair], {
      dniZapasu: 30,
      dniOkresu: 30,
      salesTrack: false,
      excludedTwIds: new Set([20]),
    });
    expect(out.find((l) => l.tw_Id === 20)!.doZamowieniaReczne).toBe(0);
    expect(out.find((l) => l.tw_Id === 10)!.doZamowieniaReczne).toBe(90);
  });

  it("B7: pack wykluczony → 0", () => {
    const lines = [
      line({ tw_Id: 10, tw_Symbol: "PACK", dostepne: 0, sprzedazOkres: 0 }),
      line({ tw_Id: 20, tw_Symbol: "PC", dostepne: 0, sprzedazOkres: 90 }),
    ];
    const out = applyZdEstimatePairs(lines, [pair], {
      dniZapasu: 30,
      dniOkresu: 30,
      salesTrack: false,
      excludedTwIds: new Set([10]),
    });
    expect(out.find((l) => l.tw_Id === 10)!.doZamowieniaReczne).toBe(0);
  });

  it("B8: partner missing → qty 0 + flaga", () => {
    const lines = [
      line({ tw_Id: 10, tw_Symbol: "PACK", dostepne: 0, sprzedazOkres: 0 }),
    ];
    const out = applyZdEstimatePairs(lines, [pair], {
      dniZapasu: 30,
      salesTrack: false,
      missingPartnerTwIds: new Set([20]),
    });
    const pack = out.find((l) => l.tw_Id === 10)!;
    expect(pack.doZamowieniaReczne).toBe(0);
    expect(pack.pair?.partnerMissing).toBe(true);
  });

  it("S10: niedobór < ratio → piecesNeeded niepełna paczka (ceil w UI)", () => {
    const lines = [
      line({ tw_Id: 10, tw_Symbol: "PACK", dostepne: 0, sprzedazOkres: 0 }),
      line({ tw_Id: 20, tw_Symbol: "PC", dostepne: 0, sprzedazOkres: 50 }),
    ];
    const out = applyZdEstimatePairs(lines, [pair], {
      dniZapasu: 30,
      dniOkresu: 30,
      salesTrack: false,
    });
    // cel≈50, need 50 szt — packaging zrobi 1 paczkę
    expect(out.find((l) => l.tw_Id === 10)!.doZamowieniaReczne).toBe(50);
  });

  it("S2/S4: sprzedaż paczek × ratio w popycie", () => {
    const lines = [
      line({ tw_Id: 10, tw_Symbol: "PACK", dostepne: 0, sprzedazOkres: 2 }), // 2 paczki
      line({ tw_Id: 20, tw_Symbol: "PC", dostepne: 0, sprzedazOkres: 0 }),
    ];
    const out = applyZdEstimatePairs(lines, [pair], {
      dniZapasu: 30,
      dniOkresu: 30,
      salesTrack: false,
    });
    const pack = out.find((l) => l.tw_Id === 10)!;
    expect(pack.pair?.sprzedazSzt).toBe(200);
    expect(pack.doZamowieniaReczne).toBe(200);
  });

  it("S5: oba kanały — suma bez podwójnego cover", () => {
    const lines = [
      line({ tw_Id: 10, tw_Symbol: "PACK", dostepne: 1, sprzedazOkres: 1 }),
      line({ tw_Id: 20, tw_Symbol: "PC", dostepne: 50, sprzedazOkres: 100 }),
    ];
    const out = applyZdEstimatePairs(lines, [pair], {
      dniZapasu: 30,
      dniOkresu: 30,
      salesTrack: false,
    });
    const pack = out.find((l) => l.tw_Id === 10)!;
    expect(pack.pair?.sprzedazSzt).toBe(100 + 100);
    expect(pack.pair?.coverSzt).toBe(50 + 100);
    // cel 200, cover 150 → need 50
    expect(pack.doZamowieniaReczne).toBe(50);
  });

  it("S6: zero sprzedaży + cover ≥ cel → dead_stock / qty 0", () => {
    const lines = [
      line({ tw_Id: 10, tw_Symbol: "PACK", dostepne: 5, sprzedazOkres: 0 }),
      line({ tw_Id: 20, tw_Symbol: "PC", dostepne: 0, sprzedazOkres: 0 }),
    ];
    const out = applyZdEstimatePairs(lines, [pair], {
      dniZapasu: 30,
      dniOkresu: 30,
      zapasMin: 100,
      salesTrack: true,
      salesTrackCuts: true,
    });
    const pack = out.find((l) => l.tw_Id === 10)!;
    expect(pack.pair?.sprzedazSzt).toBe(0);
    expect(pack.pair?.coverSzt).toBe(500);
    // celBase = zapasMin 100, cover 500 → dead_stock → cel 0
    expect(pack.salesTrackReasons).toContain("dead_stock");
    expect(pack.doZamowieniaReczne).toBe(0);
  });

  it("S7/S8: sales-track na złączonym cover (boost/cut)", () => {
    const thin = applyZdEstimatePairs(
      [
        line({ tw_Id: 10, tw_Symbol: "PACK", dostepne: 0, sprzedazOkres: 0 }),
        line({
          tw_Id: 20,
          tw_Symbol: "PC",
          dostepne: 10,
          sprzedazOkres: 300,
        }),
      ],
      [pair],
      { dniZapasu: 30, dniOkresu: 30, salesTrack: true, salesTrackCuts: true }
    );
    const thinPack = thin.find((l) => l.tw_Id === 10)!;
    expect(thinPack.celZapasuTracked).toBeGreaterThan(thinPack.celZapasu);
    expect(thinPack.salesTrackReasons).toContain("thin_cover");
    expect(thinPack.salesTrackDelta).toBeGreaterThan(0);

    const thick = applyZdEstimatePairs(
      [
        line({ tw_Id: 10, tw_Symbol: "PACK", dostepne: 20, sprzedazOkres: 0 }),
        line({
          tw_Id: 20,
          tw_Symbol: "PC",
          dostepne: 0,
          sprzedazOkres: 30,
        }),
      ],
      [pair],
      { dniZapasu: 30, dniOkresu: 30, salesTrack: true, salesTrackCuts: true }
    );
    const thickPack = thick.find((l) => l.tw_Id === 10)!;
    expect(thickPack.pair?.coverSzt).toBe(2000);
    expect(thickPack.salesTrackReasons).toEqual(
      expect.arrayContaining(["fat_cover"])
    );
    expect(thickPack.celZapasuTracked).toBeLessThan(thickPack.celZapasu);
    expect(thickPack.doZamowieniaReczne).toBe(0);
  });

  it("history_slow na pack snapshot po merge (sprzedaż pary)", () => {
    const lines = [
      line({ tw_Id: 10, tw_Symbol: "PACK", dostepne: 0, sprzedazOkres: 0 }),
      line({ tw_Id: 20, tw_Symbol: "PC", dostepne: 0, sprzedazOkres: 90 }),
    ];
    const withoutHist = applyZdEstimatePairs(lines, [pair], {
      dniZapasu: 30,
      dniOkresu: 30,
      salesTrack: true,
      salesTrackCuts: true,
    });
    const withHist = applyZdEstimatePairs(lines, [pair], {
      dniZapasu: 30,
      dniOkresu: 30,
      salesTrack: true,
      salesTrackCuts: true,
      historyByTwId: new Map([
        [
          10,
          {
            lastOrderedQty: 500,
            linkedAt: new Date(Date.now() - 90 * 86400000).toISOString(),
          },
        ],
      ]),
    });
    const a = withoutHist.find((l) => l.tw_Id === 10)!;
    const b = withHist.find((l) => l.tw_Id === 10)!;
    expect(b.celZapasuTracked).toBeLessThanOrEqual(a.celZapasuTracked);
    if (b.salesTrackReasons.includes("history_slow")) {
      expect(b.celZapasuTracked).toBeLessThan(a.celZapasuTracked);
    }
  });

  it("historia pary = sztuki pack + piece (bez ponownego × ratio)", () => {
    const lines = [
      line({ tw_Id: 10, tw_Symbol: "PACK", dostepne: 0, sprzedazOkres: 0 }),
      line({ tw_Id: 20, tw_Symbol: "PC", dostepne: 0, sprzedazOkres: 90 }),
    ];
    const linkedAt = new Date(Date.now() - 90 * 86400000).toISOString();
    const packOnly = applyZdEstimatePairs(lines, [pair], {
      dniZapasu: 30,
      dniOkresu: 30,
      salesTrack: true,
      salesTrackCuts: true,
      historyByTwId: new Map([
        [10, { lastOrderedQty: 200, linkedAt }],
      ]),
    });
    const packPlusPiece = applyZdEstimatePairs(lines, [pair], {
      dniZapasu: 30,
      dniOkresu: 30,
      salesTrack: true,
      salesTrackCuts: true,
      historyByTwId: new Map([
        [10, { lastOrderedQty: 200, linkedAt }],
        [20, { lastOrderedQty: 300, linkedAt }],
      ]),
    });
    const a = packOnly.find((l) => l.tw_Id === 10)!;
    const b = packPlusPiece.find((l) => l.tw_Id === 10)!;
    // Większa lastOrderedQty → silniejszy (lub równy) history_slow cut.
    expect(b.celZapasuTracked).toBeLessThanOrEqual(a.celZapasuTracked);
  });
});

describe("mergePairHistoryForCut", () => {
  it("sumuje sztuki i bierze nowszy linkedAt z wpisów z qty", () => {
    const older = "2026-01-01T00:00:00.000Z";
    const newer = "2026-03-01T00:00:00.000Z";
    const merged = mergePairHistoryForCut(
      { lastOrderedQty: 100, linkedAt: older },
      { lastOrderedQty: 50, linkedAt: newer }
    );
    expect(merged).toEqual({ lastOrderedQty: 150, linkedAt: newer });
  });

  it("ignoruje linkedAt strony bez qty przy wyborze daty", () => {
    const withQty = "2026-01-01T00:00:00.000Z";
    const withoutQtyNewer = "2026-06-01T00:00:00.000Z";
    const merged = mergePairHistoryForCut(
      { lastOrderedQty: 80, linkedAt: withQty },
      { lastOrderedQty: 0, linkedAt: withoutQtyNewer }
    );
    expect(merged).toEqual({ lastOrderedQty: 80, linkedAt: withQty });
  });

  it("null gdy suma qty = 0", () => {
    expect(
      mergePairHistoryForCut(
        { lastOrderedQty: 0, linkedAt: "2026-01-01T00:00:00.000Z" },
        null
      )
    ).toBeNull();
  });
});
