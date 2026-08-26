import { describe, expect, it } from "vitest";
import {
  applyBomPurchaseTargetFinalize,
  applyZdEstimateBoms,
  bomRowHidesHardExclude,
  bomRowHidesOnRequest,
  collectMissingZdBomTwIds,
  expandZdEstimateBoms,
  hasUnresolvedExplodeBomNodes,
  rematerializeSoloAfterBom,
  zdEstimateLineSalesDemandSignal,
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
  demandAllocation: "explode" as const,
  purchaseTarget: "components" as const,
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

    expect(promo.bom?.role).toBe("assembled_parent");
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
    expect(byId.get(PROMO)?.bom?.role).toBe("assembled_parent");
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
    wzNiepowiazaneOkres: 0,
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

  it("płyn w 3 składach — sprzedaż×qty i cover×qty sumują się; doZd z rematerialize", () => {
    // Solo płyn: 5 szt. sprzedaży, stan 1.
    // Zestaw A: sprzedaż 4, stan 2, cover ON, płyn ×1 → sales+4, cover+(2)*1
    // Zestaw B: sprzedaż 3, stan 1, cover ON, płyn ×2 → sales+6, cover+(1)*2
    // Zestaw C: sprzedaż 2, cover OFF, płyn ×3 → sales+6, cover+0
    // Σ sales wkład = 4+6+6 = 16 → sprzedazOkres = 5+16 = 21
    // Σ cover = 2+2 = 4 → dostepne = 1+4 = 5
    // dniZapasu=dniOkresu, track off → cel=21, doZd = max(0, 21-5) = 16
    const lines = [
      line({
        tw_Id: PLYN,
        tw_Symbol: "PLYN",
        sprzedazOkres: 5,
        dostepne: 1,
      }),
      line({
        tw_Id: 10,
        tw_Symbol: "ZEST-A",
        sprzedazOkres: 4,
        dostepne: 2,
      }),
      line({
        tw_Id: 11,
        tw_Symbol: "ZEST-B",
        sprzedazOkres: 3,
        dostepne: 1,
      }),
      line({
        tw_Id: 12,
        tw_Symbol: "ZEST-C",
        sprzedazOkres: 2,
        dostepne: 9,
      }),
    ];
    const boms = [
      {
        parentTwId: 10,
        stockAsCover: true,
        demandAllocation: "explode" as const,
        purchaseTarget: "components" as const,
        components: [{ componentTwId: PLYN, qtyPerParent: 1 }],
      },
      {
        parentTwId: 11,
        stockAsCover: true,
        demandAllocation: "explode" as const,
        purchaseTarget: "components" as const,
        components: [{ componentTwId: PLYN, qtyPerParent: 2 }],
      },
      {
        parentTwId: 12,
        stockAsCover: false,
        demandAllocation: "explode" as const,
        purchaseTarget: "components" as const,
        components: [{ componentTwId: PLYN, qtyPerParent: 3 }],
      },
    ];
    const after = applyZdEstimateBoms(lines, boms, {
      dniZapasu: 30,
      dniOkresu: 30,
      salesTrack: false,
    });
    const plyn = after.find((l) => l.tw_Id === PLYN)!;
    const a = after.find((l) => l.tw_Id === 10)!;
    const b = after.find((l) => l.tw_Id === 11)!;
    const c = after.find((l) => l.tw_Id === 12)!;

    expect(a.bom?.role).toBe("assembled_parent");
    expect(b.bom?.role).toBe("assembled_parent");
    expect(c.bom?.role).toBe("assembled_parent");
    expect(a.doZamowieniaReczne).toBe(0);
    expect(b.doZamowieniaReczne).toBe(0);
    expect(c.doZamowieniaReczne).toBe(0);

    expect(plyn.bom?.role).toBe("component");
    expect(plyn.bom?.contributionSales).toBe(16);
    expect(plyn.bom?.contributionCover).toBe(4);
    expect(plyn.sprzedazOkres).toBe(21);
    expect(plyn.dostepne).toBe(5);
    expect(plyn.doZamowieniaReczne).toBe(16);
    expect(plyn.bom?.parentTwIds?.slice().sort((x, y) => x - y)).toEqual([
      10, 11, 12,
    ]);
  });

  it("shared składnik — 2× expand z linesBase nie duplikuje wkładów", () => {
    const lines = [
      line({ tw_Id: PLYN, tw_Symbol: "PLYN", sprzedazOkres: 1, dostepne: 0 }),
      line({ tw_Id: 10, tw_Symbol: "P1", sprzedazOkres: 2, dostepne: 0 }),
      line({ tw_Id: 11, tw_Symbol: "P2", sprzedazOkres: 3, dostepne: 0 }),
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
    const opts = { dniZapasu: 30, dniOkresu: 30, salesTrack: false };
    const once = refreshZdEstimateLinesWithPairs({
      linesBase: lines,
      pairs: [],
      boms,
      options: opts,
    });
    const twice = refreshZdEstimateLinesWithPairs({
      linesBase: lines,
      pairs: [],
      boms,
      options: opts,
    });
    const p1 = once.lines.find((l) => l.tw_Id === PLYN)!;
    const p2 = twice.lines.find((l) => l.tw_Id === PLYN)!;
    expect(p1.sprzedazOkres).toBe(9);
    expect(p2.sprzedazOkres).toBe(9);
    expect(p1.bom?.contributionSales).toBe(8);
    expect(p2.bom?.contributionSales).toBe(8);
    expect(p1.doZamowieniaReczne).toBe(p2.doZamowieniaReczne);
  });

  it("nested BOM (zestaw jako składnik) — wkład schodzi na liście składników, rola zestawu zostaje", () => {
    // K (sprzedaż 10) = zestaw A×1; P (sprzedaż 5) = zestaw z K×1.
    // Oczekiwane: A dostaje 10 + 5 = 15; K i P doZd=0 jako assembled_parent.
    const lines = [
      line({ tw_Id: 1, tw_Symbol: "A", sprzedazOkres: 0, dostepne: 0 }),
      line({ tw_Id: 2, tw_Symbol: "K", sprzedazOkres: 10, dostepne: 0 }),
      line({ tw_Id: 3, tw_Symbol: "P", sprzedazOkres: 5, dostepne: 0 }),
    ];
    const after = applyZdEstimateBoms(
      lines,
      [
        {
          parentTwId: 2,
          stockAsCover: false,
          demandAllocation: "explode",
          purchaseTarget: "components",
          components: [{ componentTwId: 1, qtyPerParent: 1 }],
        },
        {
          parentTwId: 3,
          stockAsCover: false,
          demandAllocation: "explode",
          purchaseTarget: "components",
          components: [{ componentTwId: 2, qtyPerParent: 1 }],
        },
      ],
      { dniZapasu: 30, dniOkresu: 30, salesTrack: false }
    );
    const a = after.find((l) => l.tw_Id === 1)!;
    const k = after.find((l) => l.tw_Id === 2)!;
    const p = after.find((l) => l.tw_Id === 3)!;
    expect(p.bom?.role).toBe("assembled_parent");
    expect(p.doZamowieniaReczne).toBe(0);
    expect(k.bom?.role).toBe("assembled_parent");
    expect(k.doZamowieniaReczne).toBe(0);
    expect(a.sprzedazOkres).toBe(15);
    expect(a.bom?.contributionSales).toBe(15);
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

    // Nawet gdy omyłkowo podamy już expanded jako base — coerce odzyskuje własne sales.
    const fromExpanded = refreshZdEstimateLinesWithPairs({
      linesBase: once.lines,
      pairs: [castoritPair],
      boms: [bom],
      options: { dniZapasu: 30, dniOkresu: 30, salesTrack: false },
    });
    expect(
      fromExpanded.lines.find((l) => l.tw_Id === PLYN)!.sprzedazOkres
    ).toBe(7);
    // Pack: pair+bom — coerce musi odjąć contribution (inaczej 130→210).
    expect(
      fromExpanded.lines.find((l) => l.tw_Id === KARTON)!.pair?.sprzedazSzt
    ).toBe(130);

    // Surowy expand na już expanded: idempotentny (assembled_parent → skip wkładu).
    const doubleExpand = expandZdEstimateBoms(once.lines, [bom]);
    expect(
      doubleExpand.find((l) => l.tw_Id === PLYN)!.sprzedazOkres
    ).toBe(7);
  });

  it("P2 buy_separate: K zachowuje doZd, bez rollupu na A/B", () => {
    const lines = [
      line({
        tw_Id: 10,
        tw_Symbol: "A",
        sprzedazOkres: 100,
        dostepne: 40,
        doZamowieniaReczne: 60,
        celZapasu: 100,
        celZapasuTracked: 100,
      }),
      line({
        tw_Id: 20,
        tw_Symbol: "B",
        sprzedazOkres: 80,
        dostepne: 50,
        doZamowieniaReczne: 30,
        celZapasu: 80,
        celZapasuTracked: 80,
      }),
      line({
        tw_Id: 30,
        tw_Symbol: "K",
        sprzedazOkres: 30,
        dostepne: 10,
        doZamowieniaReczne: 20,
        celZapasu: 30,
        celZapasuTracked: 30,
      }),
    ];
    const bom = {
      parentTwId: 30,
      stockAsCover: true, // stale — silnik ignoruje przy separate
      demandAllocation: "separate" as const,
      purchaseTarget: "as_sold" as const,
      components: [
        { componentTwId: 10, qtyPerParent: 1 },
        { componentTwId: 20, qtyPerParent: 1 },
      ],
    };
    const after = applyBomPurchaseTargetFinalize(
      applyZdEstimateBoms(lines, [bom], {
        dniZapasu: 30,
        dniOkresu: 30,
        salesTrack: false,
      })
    );
    expect(after.find((l) => l.tw_Id === 30)?.bom?.role).toBe("purchased_kit");
    expect(after.find((l) => l.tw_Id === 30)?.doZamowieniaReczne).toBe(20);
    expect(after.find((l) => l.tw_Id === 10)?.sprzedazOkres).toBe(100);
    expect(after.find((l) => l.tw_Id === 10)?.dostepne).toBe(40);
    expect(after.find((l) => l.tw_Id === 10)?.doZamowieniaReczne).toBe(60);
    const orderable = filterOrderableLinesWithPackaging(after, new Map());
    expect(orderable.map((r) => r.tw_Id).sort()).toEqual([10, 20, 30]);
  });

  it("assembled_parent finalize czyści salesTrackQtyReview", () => {
    const parent = line({
      tw_Id: 99,
      tw_Symbol: "PARENT",
      doZamowieniaReczne: 5,
      salesTrackQtyReview: true,
      salesTrackHeldExtraQty: 1,
      salesTrackReasons: ["thin_cover", "boost_held"],
      bom: { role: "assembled_parent" },
    });
    const after = applyBomPurchaseTargetFinalize([parent]);
    expect(after[0]?.doZamowieniaReczne).toBe(0);
    expect(after[0]?.salesTrackQtyReview).toBe(false);
    expect(after[0]?.salesTrackReasons).toEqual(["thin_cover"]);
  });

  it("P3 kit_only: A/B doZd=0 nawet gdy składnik jest packiem pary", () => {
    const lines = [
      line({
        tw_Id: KARTON,
        tw_Symbol: "KARTON",
        sprzedazOkres: 5,
        dostepne: 0,
        doZamowieniaReczne: 5,
      }),
      line({
        tw_Id: MASA,
        tw_Symbol: "MASA",
        sprzedazOkres: 10,
        dostepne: 0,
      }),
      line({
        tw_Id: PROMO,
        tw_Symbol: "PROMO",
        sprzedazOkres: 4,
        dostepne: 0,
        doZamowieniaReczne: 4,
      }),
    ];
    const bom = {
      parentTwId: PROMO,
      stockAsCover: false,
      demandAllocation: "separate" as const,
      purchaseTarget: "kit_only" as const,
      components: [
        { componentTwId: KARTON, qtyPerParent: 1 },
        { componentTwId: MASA, qtyPerParent: 1 },
      ],
    };
    const refreshed = refreshZdEstimateLinesWithPairs({
      linesBase: lines,
      pairs: [castoritPair],
      boms: [bom],
      options: { dniZapasu: 30, dniOkresu: 30, salesTrack: false },
    });
    const karton = refreshed.lines.find((l) => l.tw_Id === KARTON)!;
    const promo = refreshed.lines.find((l) => l.tw_Id === PROMO)!;
    expect(promo.bom?.role).toBe("purchased_kit");
    expect(promo.bom?.purchaseTarget).toBe("kit_only");
    expect(promo.doZamowieniaReczne).toBe(4);
    expect(karton.bom?.purchaseBlocked).toBe(true);
    expect(karton.doZamowieniaReczne).toBe(0);
    expect(resolveOrderQtyForLine(karton).zdUnits).toBe(0);
  });

  it("P4 kit_from_components (MIX 6): Do ZD kitu = max sprzedaży kolorów, składniki zablokowane", () => {
    const MIX = 990;
    const colors = [
      { id: 101, sales: 3.15 },
      { id: 102, sales: 2.49 },
      { id: 103, sales: 12 },
      { id: 104, sales: 2.66 },
      { id: 105, sales: 11 },
      { id: 106, sales: 10 },
    ] as const;
    const lines = [
      ...colors.map((c) =>
        line({
          tw_Id: c.id,
          tw_Symbol: `C${c.id}`,
          sprzedazOkres: c.sales,
          dostepne: 0,
          doZamowieniaReczne: Math.ceil(c.sales),
        })
      ),
      line({
        tw_Id: MIX,
        tw_Symbol: "C300990",
        sprzedazOkres: 0,
        dostepne: 0,
        doZamowieniaReczne: 0,
      }),
    ];
    const bom = {
      parentTwId: MIX,
      stockAsCover: false,
      demandAllocation: "separate" as const,
      purchaseTarget: "kit_from_components" as const,
      components: colors.map((c) => ({
        componentTwId: c.id,
        qtyPerParent: 1,
      })),
    };
    const after = applyBomPurchaseTargetFinalize(
      applyZdEstimateBoms(lines, [bom], {
        dniZapasu: 30,
        dniOkresu: 30,
        salesTrack: false,
      })
    );
    const kit = after.find((l) => l.tw_Id === MIX)!;
    expect(kit.bom?.role).toBe("purchased_kit");
    expect(kit.bom?.purchaseTarget).toBe("kit_from_components");
    expect(kit.bom?.rollupSales).toBe(12);
    expect(kit.bom?.kitOwnSales).toBe(0);
    expect(kit.sprzedazOkres).toBe(12);
    expect(kit.doZamowieniaReczne).toBe(12);
    for (const c of colors) {
      const row = after.find((l) => l.tw_Id === c.id)!;
      expect(row.bom?.purchaseBlocked).toBe(true);
      expect(row.doZamowieniaReczne).toBe(0);
      expect(resolveOrderQtyForLine(row).zdUnits).toBe(0);
    }
    expect(resolveOrderQtyForLine(kit).zdUnits).toBe(12);
  });

  it("P4b kit_from_components: własna sprzedaż kitu + rollup (max)", () => {
    const MIX = 991;
    const after = applyBomPurchaseTargetFinalize(
      applyZdEstimateBoms(
        [
          line({
            tw_Id: 201,
            tw_Symbol: "A",
            sprzedazOkres: 4,
            dostepne: 0,
          }),
          line({
            tw_Id: 202,
            tw_Symbol: "B",
            sprzedazOkres: 9,
            dostepne: 0,
          }),
          line({
            tw_Id: MIX,
            tw_Symbol: "MIX",
            sprzedazOkres: 3,
            dostepne: 0,
          }),
        ],
        [
          {
            parentTwId: MIX,
            stockAsCover: false,
            demandAllocation: "separate",
            purchaseTarget: "kit_from_components",
            components: [
              { componentTwId: 201, qtyPerParent: 1 },
              { componentTwId: 202, qtyPerParent: 1 },
            ],
          },
        ],
        { dniZapasu: 30, dniOkresu: 30, salesTrack: false }
      )
    );
    const kit = after.find((l) => l.tw_Id === MIX)!;
    expect(kit.bom?.kitOwnSales).toBe(3);
    expect(kit.bom?.rollupSales).toBe(9);
    expect(kit.sprzedazOkres).toBe(12);
    expect(kit.doZamowieniaReczne).toBe(12);
  });

  it("P4c kit_from_components: qtyPerParent>1 — sales/qty", () => {
    const MIX = 992;
    const after = applyBomPurchaseTargetFinalize(
      applyZdEstimateBoms(
        [
          line({
            tw_Id: 301,
            tw_Symbol: "X",
            sprzedazOkres: 20,
            dostepne: 0,
          }),
          line({
            tw_Id: MIX,
            tw_Symbol: "MIX",
            sprzedazOkres: 0,
            dostepne: 0,
          }),
        ],
        [
          {
            parentTwId: MIX,
            stockAsCover: false,
            demandAllocation: "separate",
            purchaseTarget: "kit_from_components",
            components: [{ componentTwId: 301, qtyPerParent: 4 }],
          },
        ],
        { dniZapasu: 30, dniOkresu: 30, salesTrack: false }
      )
    );
    const kit = after.find((l) => l.tw_Id === MIX)!;
    expect(kit.bom?.rollupSales).toBe(5);
    expect(kit.doZamowieniaReczne).toBe(5);
  });

  it("P4d kit_from_components: 2× expand nie dubluje rollupu", () => {
    const MIX = 993;
    const bom = {
      parentTwId: MIX,
      stockAsCover: false,
      demandAllocation: "separate" as const,
      purchaseTarget: "kit_from_components" as const,
      components: [
        { componentTwId: 401, qtyPerParent: 1 },
        { componentTwId: 402, qtyPerParent: 1 },
      ],
    };
    const base = [
      line({ tw_Id: 401, tw_Symbol: "A", sprzedazOkres: 4, dostepne: 0 }),
      line({ tw_Id: 402, tw_Symbol: "B", sprzedazOkres: 9, dostepne: 0 }),
      line({ tw_Id: MIX, tw_Symbol: "MIX", sprzedazOkres: 1, dostepne: 0 }),
    ];
    const once = applyZdEstimateBoms(base, [bom], {
      dniZapasu: 30,
      dniOkresu: 30,
      salesTrack: false,
    });
    const twice = applyZdEstimateBoms(once, [bom], {
      dniZapasu: 30,
      dniOkresu: 30,
      salesTrack: false,
    });
    const k1 = once.find((l) => l.tw_Id === MIX)!;
    const k2 = twice.find((l) => l.tw_Id === MIX)!;
    expect(k1.sprzedazOkres).toBe(10); // 1 + max(4,9)
    expect(k2.sprzedazOkres).toBe(10);
    expect(k1.bom?.kitOwnSales).toBe(1);
    expect(k2.bom?.kitOwnSales).toBe(1);
    expect(k2.bom?.rollupSales).toBe(9);
  });

  it("multi-BOM: explode wygrywa nad kit_only na tym samym składniku", () => {
    const lines = [
      line({
        tw_Id: PLYN,
        tw_Symbol: "PLYN",
        sprzedazOkres: 1,
        dostepne: 0,
        doZamowieniaReczne: 1,
      }),
      line({
        tw_Id: 10,
        tw_Symbol: "PROMO",
        sprzedazOkres: 4,
        dostepne: 0,
      }),
      line({
        tw_Id: 11,
        tw_Symbol: "KIT",
        sprzedazOkres: 2,
        dostepne: 0,
        doZamowieniaReczne: 2,
      }),
    ];
    const after = applyBomPurchaseTargetFinalize(
      applyZdEstimateBoms(
        lines,
        [
          {
            parentTwId: 11,
            stockAsCover: false,
            demandAllocation: "separate",
            purchaseTarget: "kit_only",
            components: [{ componentTwId: PLYN, qtyPerParent: 1 }],
          },
          {
            parentTwId: 10,
            stockAsCover: false,
            demandAllocation: "explode",
            purchaseTarget: "components",
            components: [{ componentTwId: PLYN, qtyPerParent: 1 }],
          },
        ],
        { dniZapasu: 30, dniOkresu: 30, salesTrack: false }
      )
    );
    const plyn = after.find((l) => l.tw_Id === PLYN)!;
    expect(plyn.bom?.contributionSales).toBe(4);
    expect(plyn.bom?.purchaseBlocked).toBeFalsy();
    expect(plyn.doZamowieniaReczne).toBe(5); // 1 solo + 4 z promo
  });

  it("cover parent otwarteZd przez packaging (jednostki ZD → sztuki)", () => {
    const lines = [
      line({ tw_Id: PLYN, tw_Symbol: "PLYN", sprzedazOkres: 0, dostepne: 0 }),
      line({
        tw_Id: PROMO,
        tw_Symbol: "PROMO",
        sprzedazOkres: 0,
    wzNiepowiazaneOkres: 0,
        dostepne: 0,
        otwarteZd: 2,
      }),
    ];
    const after = applyZdEstimateBoms(
      lines,
      [
        {
          parentTwId: PROMO,
          stockAsCover: true,
          demandAllocation: "explode",
          purchaseTarget: "components",
          components: [{ componentTwId: PLYN, qtyPerParent: 1 }],
        },
      ],
      {
        dniZapasu: 30,
        dniOkresu: 30,
        salesTrack: false,
        packagingByTwId: new Map([[PROMO, { unitsPerPackage: 10 }]]),
      }
    );
    const plyn = after.find((l) => l.tw_Id === PLYN)!;
    // 2 paczki × 10 = 20 szt cover
    expect(plyn.dostepne).toBe(20);
    expect(plyn.bom?.contributionCover).toBe(20);
  });

  it("P2: asercja ZD_B=30 (pełne §6)", () => {
    const lines = [
      line({
        tw_Id: 10,
        tw_Symbol: "A",
        sprzedazOkres: 100,
        dostepne: 40,
        doZamowieniaReczne: 60,
        celZapasu: 100,
        celZapasuTracked: 100,
      }),
      line({
        tw_Id: 20,
        tw_Symbol: "B",
        sprzedazOkres: 80,
        dostepne: 50,
        doZamowieniaReczne: 30,
        celZapasu: 80,
        celZapasuTracked: 80,
      }),
      line({
        tw_Id: 30,
        tw_Symbol: "K",
        sprzedazOkres: 30,
        dostepne: 10,
        doZamowieniaReczne: 20,
        celZapasu: 30,
        celZapasuTracked: 30,
      }),
    ];
    const after = applyBomPurchaseTargetFinalize(
      applyZdEstimateBoms(
        lines,
        [
          {
            parentTwId: 30,
            stockAsCover: true,
            demandAllocation: "separate",
            purchaseTarget: "as_sold",
            components: [
              { componentTwId: 10, qtyPerParent: 1 },
              { componentTwId: 20, qtyPerParent: 1 },
            ],
          },
        ],
        { dniZapasu: 30, dniOkresu: 30, salesTrack: false }
      )
    );
    expect(after.find((l) => l.tw_Id === 30)?.doZamowieniaReczne).toBe(20);
    expect(after.find((l) => l.tw_Id === 10)?.doZamowieniaReczne).toBe(60);
    expect(after.find((l) => l.tw_Id === 20)?.doZamowieniaReczne).toBe(30);
  });

  it("purchased_kit rematerializuje przy zmianie dniZapasu", () => {
    const base = [
      line({
        tw_Id: 30,
        tw_Symbol: "K",
        sprzedazOkres: 30,
        dostepne: 10,
        doZamowieniaReczne: 20,
        celZapasu: 30,
        celZapasuTracked: 30,
        otwarteZd: 0,
      }),
      line({
        tw_Id: 10,
        tw_Symbol: "A",
        sprzedazOkres: 0,
    wzNiepowiazaneOkres: 0,
        dostepne: 0,
        doZamowieniaReczne: 0,
      }),
    ];
    const bom = {
      parentTwId: 30,
      stockAsCover: false,
      demandAllocation: "separate" as const,
      purchaseTarget: "as_sold" as const,
      components: [{ componentTwId: 10, qtyPerParent: 1 }],
    };
    const at30 = applyZdEstimateBoms(base, [bom], {
      dniZapasu: 30,
      dniOkresu: 30,
      salesTrack: false,
    });
    expect(at30.find((l) => l.tw_Id === 30)?.doZamowieniaReczne).toBe(20);

    const at60 = applyZdEstimateBoms(base, [bom], {
      dniZapasu: 60,
      dniOkresu: 30,
      salesTrack: false,
    });
    // tempo 1/dzień × 60 − 10 = 50
    expect(at60.find((l) => l.tw_Id === 30)?.doZamowieniaReczne).toBe(50);
  });

  it("S-LivePresetSwitch: pozycjeBase assemble → buy_separate → kit_only bez double-expand", () => {
    const baseLines = [
      line({
        tw_Id: 10,
        tw_Symbol: "A",
        sprzedazOkres: 100,
        dostepne: 40,
        doZamowieniaReczne: 60,
        celZapasu: 100,
        celZapasuTracked: 100,
      }),
      line({
        tw_Id: 20,
        tw_Symbol: "B",
        sprzedazOkres: 80,
        dostepne: 50,
        doZamowieniaReczne: 30,
        celZapasu: 80,
        celZapasuTracked: 80,
      }),
      line({
        tw_Id: 30,
        tw_Symbol: "K",
        sprzedazOkres: 30,
        dostepne: 10,
        doZamowieniaReczne: 20,
        celZapasu: 30,
        celZapasuTracked: 30,
      }),
    ];
    const comps = [
      { componentTwId: 10, qtyPerParent: 1 },
      { componentTwId: 20, qtyPerParent: 1 },
    ];
    const assemble = refreshZdEstimateLinesWithPairs({
      linesBase: baseLines,
      pairs: [],
      boms: [
        {
          parentTwId: 30,
          stockAsCover: true,
          demandAllocation: "explode",
          purchaseTarget: "components",
          components: comps,
        },
      ],
      options: { dniZapasu: 30, dniOkresu: 30, salesTrack: false },
    }).lines;
    expect(assemble.find((l) => l.tw_Id === 30)?.doZamowieniaReczne).toBe(0);
    expect(assemble.find((l) => l.tw_Id === 10)?.sprzedazOkres).toBe(130);

    const buy = refreshZdEstimateLinesWithPairs({
      linesBase: baseLines,
      pairs: [],
      boms: [
        {
          parentTwId: 30,
          stockAsCover: true,
          demandAllocation: "separate",
          purchaseTarget: "as_sold",
          components: comps,
        },
      ],
      options: { dniZapasu: 30, dniOkresu: 30, salesTrack: false },
    }).lines;
    expect(buy.find((l) => l.tw_Id === 30)?.doZamowieniaReczne).toBe(20);
    expect(buy.find((l) => l.tw_Id === 10)?.sprzedazOkres).toBe(100);
    expect(buy.find((l) => l.tw_Id === 20)?.doZamowieniaReczne).toBe(30);

    const kitOnly = refreshZdEstimateLinesWithPairs({
      linesBase: baseLines,
      pairs: [],
      boms: [
        {
          parentTwId: 30,
          stockAsCover: false,
          demandAllocation: "separate",
          purchaseTarget: "kit_only",
          components: comps,
        },
      ],
      options: { dniZapasu: 30, dniOkresu: 30, salesTrack: false },
    }).lines;
    expect(kitOnly.find((l) => l.tw_Id === 30)?.doZamowieniaReczne).toBe(20);
    expect(kitOnly.find((l) => l.tw_Id === 10)?.doZamowieniaReczne).toBe(0);
    expect(kitOnly.find((l) => l.tw_Id === 20)?.doZamowieniaReczne).toBe(0);
  });

  it("nielegalna para policy jest pomijana w expand", () => {
    const lines = [
      line({ tw_Id: 30, tw_Symbol: "K", sprzedazOkres: 10, doZamowieniaReczne: 5 }),
      line({ tw_Id: 10, tw_Symbol: "A", sprzedazOkres: 0, doZamowieniaReczne: 0 }),
    ];
    const after = expandZdEstimateBoms(lines, [
      {
        parentTwId: 30,
        stockAsCover: true,
        demandAllocation: "explode",
        purchaseTarget: "kit_only",
        components: [{ componentTwId: 10, qtyPerParent: 1 }],
      },
    ]);
    expect(after.find((l) => l.tw_Id === 30)?.bom).toBeNull();
    expect(after.find((l) => l.tw_Id === 10)?.sprzedazOkres).toBe(0);
  });

  it("hasUnresolvedExplodeBomNodes / bomRowHidesOnRequest", () => {
    expect(
      hasUnresolvedExplodeBomNodes(
        [
          {
            parentTwId: 1,
            stockAsCover: true,
            demandAllocation: "explode",
            purchaseTarget: "components",
            components: [{ componentTwId: 2, qtyPerParent: 1 }],
          },
        ],
        [2]
      )
    ).toBe(true);
    expect(
      hasUnresolvedExplodeBomNodes(
        [
          {
            parentTwId: 1,
            stockAsCover: false,
            demandAllocation: "separate",
            purchaseTarget: "kit_only",
            components: [{ componentTwId: 2, qtyPerParent: 1 }],
          },
        ],
        [2]
      )
    ).toBe(false);

    expect(
      bomRowHidesOnRequest({
        bom: { role: "component", purchaseBlocked: true },
      })
    ).toBe(true);
    expect(
      bomRowHidesHardExclude({
        bom: { role: "component", purchaseBlocked: true },
      })
    ).toBe(false);
    expect(
      bomRowHidesHardExclude({ bom: { role: "assembled_parent" } })
    ).toBe(true);
  });

  it("zdEstimateLineSalesDemandSignal: piece/parent z zerowaną kolumną", () => {
    expect(
      zdEstimateLineSalesDemandSignal(
        line({
          tw_Id: 1,
          tw_Symbol: "PC",
          sprzedazOkres: 0,
          pair: {
            role: "piece",
            twinTwId: 2,
            unitsPerPack: 10,
            sprzedazSzt: 50,
            wzNiepowiazaneSzt: 0,
            coverSzt: 0,
            pieceSprzedaz: 12,
            packSprzedaz: 0,
            pieceWzNiepowiazane: 0,
            packWzNiepowiazane: 0,
            pieceDostepne: 0,
            packDostepne: 0,
          },
        })
      )
    ).toBe(12);

    expect(
      zdEstimateLineSalesDemandSignal(
        line({
          tw_Id: 9,
          tw_Symbol: "KIT",
          sprzedazOkres: 0,
          bom: { role: "assembled_parent", relocatedSales: 8 },
        })
      )
    ).toBe(8);
  });
});
