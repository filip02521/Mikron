/**
 * Macierz WZ niepowiązanych (plan: map → BOM → pairs → UI).
 * Sprzedaż API już zawiera WZ — OnTime nie dolicza ponownie.
 */
import { describe, expect, it } from "vitest";
import { expandZdEstimateBoms } from "@/lib/orders/zd-estimate-bom";
import {
  formatQty,
  mapZdEstimateLineToManual,
  type ManualZdEstimateLine,
} from "@/lib/orders/zd-estimate-manual";
import { resolveOrderQtyForLine } from "@/lib/orders/zd-estimate-packaging";
import { applyZdEstimatePairs } from "@/lib/orders/zd-estimate-pairs";
import {
  pairSalesPieces,
  pairWzSalesPieces,
} from "@/lib/orders/zd-product-pair-units";
import {
  asWzNiepowiazaneQty,
  formatWzSalesSubline,
  formatWzSalesTitle,
} from "@/lib/orders/zd-estimate-wz-sales-ui";

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
    wzNiepowiazaneOkres: 0,
    sprzedazDziennie: 0,
    celZapasu: 0,
    celZapasuTracked: 0,
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
    doZamowieniaReczne: 0,
    wkladZk: 0,
    pair: null,
    bom: null,
    ...partial,
  };
}

describe("WZ map clamp", () => {
  it("brak pola → 0; clamp do sprzedaz; nie dolicza do sprzedazOkres", () => {
    const missing = mapZdEstimateLineToManual(
      {
        tw_Id: 1,
        tw_Symbol: "A",
        sprzedazOkres: 30,
        celZapasu: 10,
        dostepne: 0,
        doZamowienia: 10,
      },
      { salesTrack: false }
    );
    expect(missing.sprzedazOkres).toBe(30);
    expect(missing.wzNiepowiazaneOkres).toBe(0);

    const clamped = mapZdEstimateLineToManual(
      {
        tw_Id: 2,
        tw_Symbol: "B",
        sprzedazOkres: 10,
        wzNiepowiazaneOkres: 99,
        celZapasu: 5,
        dostepne: 0,
        doZamowienia: 5,
      },
      { salesTrack: false }
    );
    expect(clamped.sprzedazOkres).toBe(10);
    expect(clamped.wzNiepowiazaneOkres).toBe(10);

    const remat = mapZdEstimateLineToManual(clamped, { salesTrack: false });
    expect(remat.wzNiepowiazaneOkres).toBe(10);
    expect(remat.sprzedazOkres).toBe(10);
  });
});

describe("WZ solo + packaging", () => {
  it("packages: resolveOrderQty nie zmienia sprzedaz/wz", () => {
    const solo = line({
      tw_Id: 7,
      tw_Symbol: "X",
      sprzedazOkres: 30,
      wzNiepowiazaneOkres: 4,
      celZapasu: 40,
      celZapasuTracked: 40,
      dostepne: 10,
      doZamowieniaReczne: 30,
    });
    const beforeSales = solo.sprzedazOkres;
    const beforeWz = solo.wzNiepowiazaneOkres;
    const q = resolveOrderQtyForLine(solo, {
      unitsPerPackage: 10,
      packageLabel: "op.",
      documentUnitMode: "packages",
    });
    expect(q.zdUnits).toBeGreaterThan(0);
    expect(solo.sprzedazOkres).toBe(beforeSales);
    expect(solo.wzNiepowiazaneOkres).toBe(beforeWz);
    // resolve nie mutuje linii — qty osobno
    expect(q.piecesNeeded).toBe(30);
  });
});

describe("WZ pair merge", () => {
  const pair = { packTwId: 10, pieceTwId: 20, unitsPerPack: 100 };

  it("pairWzSalesPieces = pairSalesPieces", () => {
    expect(
      pairWzSalesPieces({
        pieceWzNiepowiazaneOkres: 2,
        packWzNiepowiazaneOkres: 0,
        unitsPerPack: 100,
      })
    ).toBe(2);
    expect(
      pairWzSalesPieces({
        pieceWzNiepowiazaneOkres: 0,
        packWzNiepowiazaneOkres: 1,
        unitsPerPack: 100,
      })
    ).toBe(100);
    expect(
      pairSalesPieces({
        pieceSprzedazOkres: 2,
        packSprzedazOkres: 1,
        unitsPerPack: 100,
      })
    ).toBe(102);
  });

  it("piece wz 2 + pack wz 0 ×100 → wzSzt 2; pack wz 1 → 100; missing → 0", () => {
    const bothA = applyZdEstimatePairs(
      [
        line({
          tw_Id: 10,
          tw_Symbol: "PACK",
          sprzedazOkres: 1,
          wzNiepowiazaneOkres: 0,
        }),
        line({
          tw_Id: 20,
          tw_Symbol: "PC",
          sprzedazOkres: 40,
          wzNiepowiazaneOkres: 2,
        }),
      ],
      [pair],
      { dniZapasu: 30, salesTrack: false }
    );
    for (const side of bothA) {
      expect(side.pair?.wzNiepowiazaneSzt).toBe(2);
      expect(side.pair?.sprzedazSzt).toBe(140);
      expect(side.pair?.pieceWzNiepowiazane).toBe(2);
      expect(side.pair?.packWzNiepowiazane).toBe(0);
    }
    const packA = bothA.find((l) => l.tw_Id === 10)!;
    const pieceA = bothA.find((l) => l.tw_Id === 20)!;
    expect(packA.wzNiepowiazaneOkres).toBe(2);
    expect(packA.sprzedazOkres).toBe(140);
    expect(pieceA.wzNiepowiazaneOkres).toBe(0);
    expect(pieceA.sprzedazOkres).toBe(0);

    const bothB = applyZdEstimatePairs(
      [
        line({
          tw_Id: 10,
          tw_Symbol: "PACK",
          sprzedazOkres: 1,
          wzNiepowiazaneOkres: 1,
        }),
        line({
          tw_Id: 20,
          tw_Symbol: "PC",
          sprzedazOkres: 0,
          wzNiepowiazaneOkres: 0,
        }),
      ],
      [pair],
      { dniZapasu: 30, salesTrack: false }
    );
    expect(bothB[0]!.pair?.wzNiepowiazaneSzt).toBe(100);
    expect(bothB[0]!.wzNiepowiazaneOkres).toBe(100);

    const missing = applyZdEstimatePairs(
      [
        line({
          tw_Id: 10,
          tw_Symbol: "PACK",
          sprzedazOkres: 1,
          wzNiepowiazaneOkres: 1,
        }),
      ],
      [pair],
      {
        dniZapasu: 30,
        salesTrack: false,
        missingPartnerTwIds: new Set([20]),
      }
    );
    expect(missing[0]!.pair?.partnerMissing).toBe(true);
    expect(missing[0]!.pair?.wzNiepowiazaneSzt).toBe(0);
    expect(missing[0]!.sprzedazOkres).toBe(0);
    expect(missing[0]!.wzNiepowiazaneOkres).toBe(0);
  });
});

describe("WZ BOM", () => {
  it("explode: parent wz 3 × qty 2 → komponent +6; parent Sprzed./WZ = 0 (relocated)", () => {
    const parent = line({
      tw_Id: 1,
      tw_Symbol: "KIT",
      sprzedazOkres: 10,
      wzNiepowiazaneOkres: 3,
    });
    const comp = line({
      tw_Id: 2,
      tw_Symbol: "C",
      sprzedazOkres: 1,
      wzNiepowiazaneOkres: 0,
    });
    const out = expandZdEstimateBoms(
      [parent, comp],
      [
        {
          parentTwId: 1,
          stockAsCover: false,
          demandAllocation: "explode",
          purchaseTarget: "components",
          components: [{ componentTwId: 2, qtyPerParent: 2 }],
        },
      ]
    );
    const p = out.find((l) => l.tw_Id === 1)!;
    const c = out.find((l) => l.tw_Id === 2)!;
    expect(p.wzNiepowiazaneOkres).toBe(0);
    expect(p.sprzedazOkres).toBe(0);
    expect(p.bom?.role).toBe("assembled_parent");
    expect(p.bom?.relocatedSales).toBe(10);
    expect(p.bom?.relocatedWz).toBe(3);
    expect(c.sprzedazOkres).toBe(1 + 20);
    expect(c.wzNiepowiazaneOkres).toBe(6);
    expect(c.bom?.contributionWz).toBe(6);
  });

  it("separate: dziecko bez +wz z parenta", () => {
    const out = expandZdEstimateBoms(
      [
        line({
          tw_Id: 1,
          tw_Symbol: "KIT",
          sprzedazOkres: 10,
          wzNiepowiazaneOkres: 3,
        }),
        line({
          tw_Id: 2,
          tw_Symbol: "C",
          sprzedazOkres: 1,
          wzNiepowiazaneOkres: 0,
        }),
      ],
      [
        {
          parentTwId: 1,
          stockAsCover: true,
          demandAllocation: "separate",
          purchaseTarget: "as_sold",
          components: [{ componentTwId: 2, qtyPerParent: 2 }],
        },
      ]
    );
    expect(out.find((l) => l.tw_Id === 2)!.wzNiepowiazaneOkres).toBe(0);
    expect(out.find((l) => l.tw_Id === 2)!.sprzedazOkres).toBe(1);
  });

  it("nested explode: WZ push ×qty jak sales", () => {
    // Outer KIT(1) → Mid(2)×1; Mid assembled → Leaf(3)×2
    const out = expandZdEstimateBoms(
      [
        line({
          tw_Id: 1,
          tw_Symbol: "OUTER",
          sprzedazOkres: 4,
          wzNiepowiazaneOkres: 2,
        }),
        line({
          tw_Id: 2,
          tw_Symbol: "MID",
          sprzedazOkres: 0,
          wzNiepowiazaneOkres: 0,
        }),
        line({
          tw_Id: 3,
          tw_Symbol: "LEAF",
          sprzedazOkres: 1,
          wzNiepowiazaneOkres: 0,
        }),
      ],
      [
        {
          parentTwId: 1,
          stockAsCover: false,
          demandAllocation: "explode",
          purchaseTarget: "components",
          components: [{ componentTwId: 2, qtyPerParent: 1 }],
        },
        {
          parentTwId: 2,
          stockAsCover: false,
          demandAllocation: "explode",
          purchaseTarget: "components",
          components: [{ componentTwId: 3, qtyPerParent: 2 }],
        },
      ]
    );
    const leaf = out.find((l) => l.tw_Id === 3)!;
    // sales: 1 + 4*1*2 = 9; wz: 0 + 2*1*2 = 4
    expect(leaf.sprzedazOkres).toBe(9);
    expect(leaf.wzNiepowiazaneOkres).toBe(4);
    expect(out.find((l) => l.tw_Id === 2)!.bom?.role).toBe("assembled_parent");
  });

  it("multi-BOM: suma wz z dwóch parentów", () => {
    const out = expandZdEstimateBoms(
      [
        line({
          tw_Id: 10,
          tw_Symbol: "P1",
          sprzedazOkres: 3,
          wzNiepowiazaneOkres: 1,
        }),
        line({
          tw_Id: 11,
          tw_Symbol: "P2",
          sprzedazOkres: 5,
          wzNiepowiazaneOkres: 2,
        }),
        line({
          tw_Id: 20,
          tw_Symbol: "C",
          sprzedazOkres: 0,
          wzNiepowiazaneOkres: 0,
        }),
      ],
      [
        {
          parentTwId: 10,
          stockAsCover: false,
          demandAllocation: "explode",
          purchaseTarget: "components",
          components: [{ componentTwId: 20, qtyPerParent: 1 }],
        },
        {
          parentTwId: 11,
          stockAsCover: false,
          demandAllocation: "explode",
          purchaseTarget: "components",
          components: [{ componentTwId: 20, qtyPerParent: 2 }],
        },
      ]
    );
    const c = out.find((l) => l.tw_Id === 20)!;
    // sales: 3*1 + 5*2 = 13; wz: 1*1 + 2*2 = 5
    expect(c.sprzedazOkres).toBe(13);
    expect(c.wzNiepowiazaneOkres).toBe(5);
  });
});

describe("WZ BOM potem para", () => {
  it("piece po explode + pack × ratio", () => {
    const pieceId = 20;
    const packId = 10;
    const kitId = 99;
    const afterBom = expandZdEstimateBoms(
      [
        line({
          tw_Id: kitId,
          tw_Symbol: "KIT",
          sprzedazOkres: 2,
          wzNiepowiazaneOkres: 1,
        }),
        line({
          tw_Id: pieceId,
          tw_Symbol: "PC",
          sprzedazOkres: 5,
          wzNiepowiazaneOkres: 0,
        }),
        line({
          tw_Id: packId,
          tw_Symbol: "PACK",
          sprzedazOkres: 1,
          wzNiepowiazaneOkres: 1,
        }),
      ],
      [
        {
          parentTwId: kitId,
          stockAsCover: false,
          demandAllocation: "explode",
          purchaseTarget: "components",
          components: [{ componentTwId: pieceId, qtyPerParent: 3 }],
        },
      ]
    );
    const piece = afterBom.find((l) => l.tw_Id === pieceId)!;
    expect(piece.sprzedazOkres).toBe(5 + 6);
    expect(piece.wzNiepowiazaneOkres).toBe(3);

    const merged = applyZdEstimatePairs(
      afterBom.filter((l) => l.tw_Id === pieceId || l.tw_Id === packId),
      [{ packTwId: packId, pieceTwId: pieceId, unitsPerPack: 100 }],
      { dniZapasu: 30, salesTrack: false }
    );
    // wzSzt = 3 + 1*100 = 103; sprzedazSzt = 11 + 1*100 = 111 — tylko na pack
    const pack = merged.find((l) => l.pair?.role === "pack")!;
    const pieceRow = merged.find((l) => l.pair?.role === "piece")!;
    expect(pack.pair?.wzNiepowiazaneSzt).toBe(103);
    expect(pack.sprzedazOkres).toBe(111);
    expect(pack.wzNiepowiazaneOkres).toBe(103);
    expect(pieceRow.sprzedazOkres).toBe(0);
    expect(pieceRow.wzNiepowiazaneOkres).toBe(0);
  });
});

describe("WZ UI helper", () => {
  it("null / string / title FS−WZ", () => {
    expect(asWzNiepowiazaneQty(null)).toBe(0);
    expect(asWzNiepowiazaneQty(undefined)).toBe(0);
    expect(asWzNiepowiazaneQty("4,5")).toBe(4.5);
    expect(formatWzSalesSubline(0, formatQty)).toBeNull();
    expect(formatWzSalesSubline(1e-12, formatQty)).toBeNull();
    expect(formatWzSalesSubline(4, formatQty)).toBe("w tym WZ 4");
    expect(
      formatWzSalesTitle({
        sprzedazOkres: 30,
        wzNiepowiazaneOkres: 4,
        formatQty,
      })
    ).toBe("Sprzedaż: 30 szt · FS+PA 26 + WZ niepowiązane 4");
  });
});
