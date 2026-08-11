import { describe, expect, it } from "vitest";
import {
  applyZdEstimateBoms,
  collectMissingZdBomTwIds,
  expandZdEstimateBoms,
  rematerializeSoloAfterBom,
} from "@/lib/orders/zd-estimate-bom";
import { refreshZdEstimateLinesWithPairs } from "@/lib/orders/zd-estimate-live-refresh";
import {
  buildManualZdEstimateResult,
  type ManualZdEstimateLine,
} from "@/lib/orders/zd-estimate-manual";
import {
  filterOrderableLinesWithPackaging,
  orderableLinesToTsv,
  resolveOrderQtyForLine,
} from "@/lib/orders/zd-estimate-packaging";
import { applyZdEstimatePairs } from "@/lib/orders/zd-estimate-pairs";
import { pairSalesPieces } from "@/lib/orders/zd-product-pair-units";

/** Castorit: płyn, masa (piece), karton 40× (pack), promo (BOM parent). */
const PLYN = 1;
const MASA = 2;
const KARTON = 3;
const PROMO = 4;
const RATIO = 40;

const castoritPair = {
  packTwId: KARTON,
  pieceTwId: MASA,
  unitsPerPack: RATIO,
};

const castoritBom = {
  parentTwId: PROMO,
  stockAsCover: true,
  components: [
    { componentTwId: KARTON, qtyPerParent: 1 },
    { componentTwId: PLYN, qtyPerParent: 1 },
  ],
};

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
    pair: null,
    bom: null,
    ...partial,
  };
}

function castoritBase(overrides?: {
  promoSales?: number;
  plynSales?: number;
  masaSales?: number;
  kartonSales?: number;
  promoStock?: number;
  stockAsCover?: boolean;
}) {
  const promoSales = overrides?.promoSales ?? 2;
  const plynSales = overrides?.plynSales ?? 5;
  const masaSales = overrides?.masaSales ?? 10;
  const kartonSales = overrides?.kartonSales ?? 1;
  return {
    lines: [
      line({
        tw_Id: PLYN,
        tw_Symbol: "PLYN",
        sprzedazOkres: plynSales,
        dostepne: 0,
      }),
      line({
        tw_Id: MASA,
        tw_Symbol: "MASA",
        sprzedazOkres: masaSales,
        dostepne: 0,
      }),
      line({
        tw_Id: KARTON,
        tw_Symbol: "KARTON",
        sprzedazOkres: kartonSales,
        dostepne: 0,
      }),
      line({
        tw_Id: PROMO,
        tw_Symbol: "PROMO",
        sprzedazOkres: promoSales,
        dostepne: overrides?.promoStock ?? 0,
      }),
    ],
    bom: {
      ...castoritBom,
      stockAsCover: overrides?.stockAsCover !== false,
    },
  };
}

describe("Castorit BOM + pary", () => {
  it("double-count guard: pair sales = 130, not 210", () => {
    const { lines, bom } = castoritBase();
    const afterBom = applyZdEstimateBoms(lines, [bom], {
      dniZapasu: 30,
      dniOkresu: 30,
      salesTrack: false,
      productPairs: [castoritPair],
    });
    const plyn = afterBom.find((l) => l.tw_Id === PLYN)!;
    const karton = afterBom.find((l) => l.tw_Id === KARTON)!;
    expect(plyn.sprzedazOkres).toBe(7); // 5+2
    expect(karton.sprzedazOkres).toBe(3); // 1+2 op.

    const withPairs = applyZdEstimatePairs(afterBom, [castoritPair], {
      dniZapasu: 30,
      dniOkresu: 30,
      salesTrack: false,
    });
    const pack = withPairs.find((l) => l.tw_Id === KARTON)!;
    expect(pack.pair?.sprzedazSzt).toBe(130); // 10 + 3*40
    expect(pack.pair?.sprzedazSzt).not.toBe(210); // błędny: 10+40+80+2*40?
    expect(
      pairSalesPieces({
        pieceSprzedazOkres: 10,
        packSprzedazOkres: 3,
        unitsPerPack: RATIO,
      })
    ).toBe(130);
  });

  it("płyn: rematerialize zmienia Do ZD vs samo += sprzedaż", () => {
    const { lines, bom } = castoritBase();
    const onlyExpand = expandZdEstimateBoms(lines, [bom]);
    const plynExpand = onlyExpand.find((l) => l.tw_Id === PLYN)!;
    expect(plynExpand.sprzedazOkres).toBe(7);
    // bez remat cel/doZd stare (0)
    expect(plynExpand.doZamowieniaReczne).toBe(0);

    const remat = rematerializeSoloAfterBom(onlyExpand, {
      dniZapasu: 30,
      dniOkresu: 30,
      salesTrack: false,
      productPairs: [castoritPair],
    });
    const plyn = remat.find((l) => l.tw_Id === PLYN)!;
    // cel = 7/30*30 = 7; cover 0 → doZd 7
    expect(plyn.celZapasu).toBe(7);
    expect(plyn.doZamowieniaReczne).toBe(7);
  });

  it("parent i piece poza orderable/TSV (qty 0)", () => {
    const { lines, bom } = castoritBase();
    const out = refreshZdEstimateLinesWithPairs({
      linesBase: lines,
      pairs: [castoritPair],
      boms: [bom],
      options: { dniZapasu: 30, dniOkresu: 30, salesTrack: false },
    }).lines;

    const promo = out.find((l) => l.tw_Id === PROMO)!;
    const masa = out.find((l) => l.tw_Id === MASA)!;
    const plyn = out.find((l) => l.tw_Id === PLYN)!;
    const karton = out.find((l) => l.tw_Id === KARTON)!;

    expect(promo.bom?.role).toBe("parent");
    expect(resolveOrderQtyForLine(promo).zdUnits).toBe(0);
    expect(masa.pair?.role).toBe("piece");
    expect(resolveOrderQtyForLine(masa).zdUnits).toBe(0);
    expect(resolveOrderQtyForLine(plyn).zdUnits).toBe(7);
    expect(
      resolveOrderQtyForLine(karton, {
        unitsPerPackage: RATIO,
        packageLabel: "op.",
      }).zdUnits
    ).toBeGreaterThan(0);
  });

  it("para bez BOM — regresja (sprzedaż szt = 10+1*40)", () => {
    const lines = [
      line({ tw_Id: MASA, tw_Symbol: "MASA", sprzedazOkres: 10 }),
      line({ tw_Id: KARTON, tw_Symbol: "KARTON", sprzedazOkres: 1 }),
    ];
    const out = applyZdEstimatePairs(lines, [castoritPair], {
      dniZapasu: 30,
      dniOkresu: 30,
      salesTrack: false,
    });
    expect(out.find((l) => l.tw_Id === KARTON)?.pair?.sprzedazSzt).toBe(50);
  });

  it("stock_as_cover on: stan promo w cover komponentu", () => {
    const { lines, bom } = castoritBase({
      promoSales: 0,
      plynSales: 10,
      promoStock: 3,
      stockAsCover: true,
    });
    const after = applyZdEstimateBoms(lines, [bom], {
      dniZapasu: 30,
      dniOkresu: 30,
      salesTrack: false,
      productPairs: [castoritPair],
    });
    const plyn = after.find((l) => l.tw_Id === PLYN)!;
    expect(plyn.dostepne).toBe(3);
    expect(plyn.bom?.contributionCover).toBe(3);
    expect(plyn.doZamowieniaReczne).toBe(7); // cel 10 − 3
  });

  it("stock_as_cover off: tylko sprzedaż, bez cover ze stanu", () => {
    const { lines, bom } = castoritBase({
      promoSales: 0,
      plynSales: 10,
      promoStock: 3,
      stockAsCover: false,
    });
    const after = applyZdEstimateBoms(lines, [bom], {
      dniZapasu: 30,
      dniOkresu: 30,
      salesTrack: false,
      productPairs: [castoritPair],
    });
    const plyn = after.find((l) => l.tw_Id === PLYN)!;
    expect(plyn.dostepne).toBe(0);
    expect(plyn.bom?.contributionCover).toBe(0);
    expect(plyn.doZamowieniaReczne).toBe(10);
  });

  it("missing component → flaga + collect fetch ids", () => {
    const lines = [
      line({ tw_Id: PROMO, tw_Symbol: "PROMO", sprzedazOkres: 2 }),
      line({ tw_Id: KARTON, tw_Symbol: "KARTON", sprzedazOkres: 1 }),
    ];
    expect(collectMissingZdBomTwIds(lines, [castoritBom])).toEqual(
      expect.arrayContaining([PLYN])
    );
    const expanded = expandZdEstimateBoms(lines, [castoritBom], {
      missingComponentTwIds: new Set([PLYN]),
    });
    // płyn nie na liście — karton dostał wkład + flaga fail-loud
    const karton = expanded.find((l) => l.tw_Id === KARTON)!;
    expect(karton.sprzedazOkres).toBe(3);
    expect(karton.bom?.componentMissing).toBe(true);
  });

  it("E2E Castorit: buildManual + TSV tylko płyn+karton; wykluczenie kartonu nie kasuje wkładu do płynu", () => {
    const subiektLines = [
      {
        tw_Id: PLYN,
        tw_Symbol: "PLYN",
        tw_Nazwa: "Płyn",
        sprzedazOkres: 5,
        dostepne: 0,
        celZapasu: 5,
        otwarteZd: 0,
        doZamowienia: 5,
      },
      {
        tw_Id: MASA,
        tw_Symbol: "MASA",
        tw_Nazwa: "Masa",
        sprzedazOkres: 10,
        dostepne: 0,
        celZapasu: 10,
        otwarteZd: 0,
        doZamowienia: 10,
      },
      {
        tw_Id: KARTON,
        tw_Symbol: "KARTON",
        tw_Nazwa: "Karton",
        sprzedazOkres: 1,
        dostepne: 0,
        celZapasu: 1,
        otwarteZd: 0,
        doZamowienia: 1,
      },
      {
        tw_Id: PROMO,
        tw_Symbol: "PROMO",
        tw_Nazwa: "Promo",
        sprzedazOkres: 2,
        dostepne: 0,
        celZapasu: 2,
        otwarteZd: 0,
        doZamowienia: 2,
      },
    ];

    const result = buildManualZdEstimateResult(
      { dniZapasu: 30, dniOkresu: 30, zapasMin: 0 },
      subiektLines,
      {
        salesTrack: false,
        salesTrackCuts: false,
        productPairs: [castoritPair],
        productBoms: [castoritBom],
      }
    );

    expect(result.pozycjeBase.every((l) => !l.bom && !l.pair)).toBe(true);

    const byId = new Map(result.pozycje.map((l) => [l.tw_Id, l]));
    expect(byId.get(PROMO)?.bom?.role).toBe("parent");
    expect(byId.get(PLYN)?.sprzedazOkres).toBe(7);
    expect(byId.get(KARTON)?.pair?.sprzedazSzt).toBe(130);

    const packaging = new Map([
      [KARTON, { unitsPerPackage: RATIO, packageLabel: "op." }],
    ]);
    const orderable = filterOrderableLinesWithPackaging(
      result.pozycje,
      packaging
    );
    const symbols = orderable.map((l) => l.tw_Symbol).sort();
    expect(symbols).toEqual(["KARTON", "PLYN"]);
    expect(orderable.some((l) => l.tw_Id === PROMO)).toBe(false);
    expect(orderable.some((l) => l.tw_Id === MASA)).toBe(false);

    const tsv = orderableLinesToTsv(orderable, packaging);
    expect(tsv).toContain("PLYN");
    expect(tsv).toContain("KARTON");
    expect(tsv).not.toContain("PROMO\t");
    expect(tsv).not.toContain("MASA\t");

    // Wykluczenie kartonu → qty pary 0; płyn nadal z wkładem BOM
    const excluded = buildManualZdEstimateResult(
      { dniZapasu: 30, dniOkresu: 30, zapasMin: 0 },
      subiektLines,
      {
        salesTrack: false,
        salesTrackCuts: false,
        productPairs: [castoritPair],
        productBoms: [castoritBom],
        excludedTwIds: new Set([KARTON]),
      }
    );
    expect(excluded.pozycje.find((l) => l.tw_Id === KARTON)?.doZamowieniaReczne).toBe(
      0
    );
    expect(excluded.pozycje.find((l) => l.tw_Id === PLYN)?.sprzedazOkres).toBe(7);
    expect(
      excluded.pozycje.find((l) => l.tw_Id === PLYN)?.doZamowieniaReczne
    ).toBe(7);
  });

  it("otwarteZd parenta w cover; otwarteZk NIE", () => {
    const lines = [
      line({
        tw_Id: PLYN,
        tw_Symbol: "PLYN",
        sprzedazOkres: 10,
        dostepne: 0,
        otwarteZkBezRez: 99,
      }),
      line({
        tw_Id: PROMO,
        tw_Symbol: "PROMO",
        sprzedazOkres: 0,
        dostepne: 1,
        otwarteZd: 2,
        otwarteZkBezRez: 50,
      }),
    ];
    const after = applyZdEstimateBoms(
      lines,
      [
        {
          parentTwId: PROMO,
          stockAsCover: true,
          components: [{ componentTwId: PLYN, qtyPerParent: 1 }],
        },
      ],
      { dniZapasu: 30, dniOkresu: 30, salesTrack: false }
    );
    const plyn = after.find((l) => l.tw_Id === PLYN)!;
    // cover = dostepne(1) + otwarteZd(2) = 3; ZK ignorowane
    expect(plyn.dostepne).toBe(3);
    expect(plyn.bom?.contributionCover).toBe(3);
  });

  it("dwa BOM na płyn — suma wkładów", () => {
    const lines = [
      line({ tw_Id: PLYN, tw_Symbol: "PLYN", sprzedazOkres: 1 }),
      line({ tw_Id: 10, tw_Symbol: "P1", sprzedazOkres: 2 }),
      line({ tw_Id: 11, tw_Symbol: "P2", sprzedazOkres: 3 }),
    ];
    const boms = [
      {
        parentTwId: 10,
        stockAsCover: false,
        components: [{ componentTwId: PLYN, qtyPerParent: 1 }],
      },
      {
        parentTwId: 11,
        stockAsCover: false,
        components: [{ componentTwId: PLYN, qtyPerParent: 2 }],
      },
    ];
    const after = applyZdEstimateBoms(lines, boms, {
      dniZapasu: 30,
      dniOkresu: 30,
      salesTrack: false,
    });
    const plyn = after.find((l) => l.tw_Id === PLYN)!;
    // 1 + 2*1 + 3*2 = 1+2+6 = 9
    expect(plyn.sprzedazOkres).toBe(9);
    expect(plyn.bom?.contributionSales).toBe(8);
    expect(plyn.bom?.parentTwIds).toEqual(expect.arrayContaining([10, 11]));
  });

  it("live refresh z pozycjeBase idempotentny (2× expand nie duplikuje)", () => {
    const { lines, bom } = castoritBase();
    const once = refreshZdEstimateLinesWithPairs({
      linesBase: lines,
      pairs: [castoritPair],
      boms: [bom],
      options: { dniZapasu: 30, dniOkresu: 30, salesTrack: false },
    });
    const twice = refreshZdEstimateLinesWithPairs({
      linesBase: lines, // zawsze base pre-BOM
      pairs: [castoritPair],
      boms: [bom],
      options: { dniZapasu: 30, dniOkresu: 30, salesTrack: false },
    });
    const p1 = once.lines.find((l) => l.tw_Id === PLYN)!;
    const p2 = twice.lines.find((l) => l.tw_Id === PLYN)!;
    expect(p1.sprzedazOkres).toBe(7);
    expect(p2.sprzedazOkres).toBe(7);
    expect(p1.doZamowieniaReczne).toBe(p2.doZamowieniaReczne);

    // Błąd: expand na już expanded → 7+2=9
    const doubleExpand = expandZdEstimateBoms(once.lines, [bom]);
    expect(
      doubleExpand.find((l) => l.tw_Id === PLYN)!.sprzedazOkres
    ).toBeGreaterThan(7);
  });
});
