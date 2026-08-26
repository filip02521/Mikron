import { describe, expect, it } from "vitest";
import {
  mapZdEstimateLineToManual,
  type ManualZdEstimateLine,
} from "./zd-estimate-manual";
import {
  assertOrderMultiple,
  assertPackagingUnits,
  computeZdPackOrderQty,
  effectiveZdDocumentUnits,
  filterOrderableLinesWithPackaging,
  formatZdPackCompactLabel,
  formatZdPackDocumentLabel,
  formatZdPackHint,
  formatZdPackOrderPreviewLine,
  formatZdPackRoundupLine,
  formatZdPackTableRatioLabel,
  formatZdPackUnitsPerLabelHint,
  getZdPackRoundupInfo,
  isZdUnitsMultipleOfOrderMultiple,
  lineAllowsZdDocumentUnitOverride,
  piecesArrivingForZdUnits,
  packagingRowsToRefreshLookup,
  pruneZdDocumentUnitOverrides,
  resolveOrderQtyForLine,
  summarizePackOrderQty,
} from "./zd-estimate-packaging";

describe("formatZdPackCompactLabel", () => {
  it("skraca preset zbiorcze / karton / paczka", () => {
    expect(formatZdPackCompactLabel("zbiorcze")).toBe("zb.");
    expect(formatZdPackCompactLabel("Zbiorcze")).toBe("zb.");
    expect(formatZdPackCompactLabel("karton")).toBe("kart.");
    expect(formatZdPackCompactLabel("paczka")).toBe("pac.");
    expect(formatZdPackCompactLabel("op.")).toBe("op.");
    expect(formatZdPackCompactLabel("op")).toBe("op.");
  });

  it("krótkie własne etykiety zostawia bez ucinania", () => {
    expect(formatZdPackCompactLabel("szt")).toBe("szt");
    expect(formatZdPackCompactLabel("BOX")).toBe("BOX");
  });

  it("długie własne etykiety skraca z kropką (bez mid-word ellipsis)", () => {
    expect(formatZdPackCompactLabel("eurokarton")).toBe("euro.");
    expect(formatZdPackCompactLabel("...")).toBe("...");
    expect(formatZdPackCompactLabel("......")).toBe("op.");
  });

  it("pusta → op.", () => {
    expect(formatZdPackCompactLabel("")).toBe("op.");
    expect(formatZdPackCompactLabel("   ")).toBe("op.");
  });
});

describe("formatZdPackTableRatioLabel / UnitsPerLabelHint", () => {
  it("ratio używa skrótu", () => {
    expect(formatZdPackTableRatioLabel("zbiorcze")).toBe("szt/zb.");
    expect(formatZdPackTableRatioLabel("karton")).toBe("szt/kart.");
  });

  it("hint menu/podgląd zostawia pełną etykietę", () => {
    expect(formatZdPackUnitsPerLabelHint(10, "zbiorcze")).toBe(
      "10 szt / 1 zbiorcze"
    );
    expect(formatZdPackUnitsPerLabelHint(2.9, "  ")).toBe("2 szt / 1 op.");
  });
});

describe("computeZdPackOrderQty", () => {
  it("Falcon: 8 szt przy op. 10 → 1 na ZD, przyjdzie 10", () => {
    const q = computeZdPackOrderQty(8, 10, "op.");
    expect(q).toMatchObject({
      piecesNeeded: 8,
      unitsPerPackage: 10,
      zdUnits: 1,
      piecesArriving: 10,
      hasPackaging: true,
      roundedUp: true,
    });
  });

  it("9 szt / N=10 → 1 na ZD, dobicie do 10", () => {
    const q = computeZdPackOrderQty(9, 10, "karton");
    expect(q).toMatchObject({
      piecesNeeded: 9,
      unitsPerPackage: 10,
      zdUnits: 1,
      piecesArriving: 10,
      hasPackaging: true,
      roundedUp: true,
      packageLabel: "karton",
      documentUnitMode: "packages",
    });
    expect(formatZdPackDocumentLabel(q)).toBe("1 karton");
    expect(formatZdPackRoundupLine(q)).toBe("dobicie +1 szt (9→10)");
  });

  it("Mode B: 8 szt / N=5 → Do ZD 10 (sztuki), nie 2 paczki", () => {
    const q = computeZdPackOrderQty(8, 5, "zbiorcze", "pieces_multiple");
    expect(q).toMatchObject({
      piecesNeeded: 8,
      unitsPerPackage: 5,
      zdUnits: 10,
      piecesArriving: 10,
      hasPackaging: true,
      roundedUp: true,
      documentUnitMode: "pieces_multiple",
    });
    expect(formatZdPackDocumentLabel(q)).toBeNull();
    expect(formatZdPackHint(q)).toContain("10 szt (paczka 5)");
    expect(formatZdPackRoundupLine(q)).toBe("dobicie +2 szt (8→10)");
  });

  it("Mode B exact multiple: 10/5 → 10, bez dobicia", () => {
    const q = computeZdPackOrderQty(10, 5, "op.", "pieces_multiple");
    expect(q.zdUnits).toBe(10);
    expect(q.roundedUp).toBe(false);
  });

  it("EVE: 250 szt przy 100 → 3 na ZD, przyjdzie 300", () => {
    const q = computeZdPackOrderQty(250, 100, "paczka");
    expect(q.zdUnits).toBe(3);
    expect(q.piecesArriving).toBe(300);
    expect(formatZdPackHint(q)).toContain("3 paczka × 100");
  });

  it("bez opakowania: 1:1 sztuki", () => {
    const q = computeZdPackOrderQty(15, 1);
    expect(q).toMatchObject({
      zdUnits: 15,
      piecesArriving: 15,
      hasPackaging: false,
      roundedUp: false,
    });
  });

  it("orderMultiple M=10, N=48: niedobór 2–3 op. → 10; exact 10; 11→20; need 0→0", () => {
    // 144 szt = 3 op. → ceil do 10
    expect(computeZdPackOrderQty(144, 48, "op.", "packages", 10)).toMatchObject({
      zdUnits: 10,
      piecesArriving: 480,
      packsBeforeOrderMultiple: 3,
      orderMultiple: 10,
      roundedUp: true,
    });
    // 96 szt = 2 op. → 10
    expect(computeZdPackOrderQty(96, 48, "op.", "packages", 10).zdUnits).toBe(
      10
    );
    // 480 szt = 10 op. exact
    expect(computeZdPackOrderQty(480, 48, "op.", "packages", 10)).toMatchObject({
      zdUnits: 10,
      packsBeforeOrderMultiple: 10,
      roundedUp: false,
    });
    // 481 → 11 → 20
    expect(computeZdPackOrderQty(481, 48, "op.", "packages", 10)).toMatchObject({
      zdUnits: 20,
      packsBeforeOrderMultiple: 11,
    });
    // bez M: 144 → 3
    expect(computeZdPackOrderQty(144, 48, "op.", "packages", null).zdUnits).toBe(
      3
    );
    // need 0 → nigdy nie dobijamy do M
    expect(computeZdPackOrderQty(0, 48, "op.", "packages", 10)).toMatchObject({
      zdUnits: 0,
      piecesArriving: 0,
      packsBeforeOrderMultiple: null,
    });
  });

  it("Mode B ignoruje orderMultiple", () => {
    const q = computeZdPackOrderQty(8, 5, "op.", "pieces_multiple", 10);
    expect(q).toMatchObject({
      zdUnits: 10,
      piecesArriving: 10,
      orderMultiple: 0,
      packsBeforeOrderMultiple: null,
      documentUnitMode: "pieces_multiple",
    });
  });
});

describe("assertPackagingUnits + format helpers", () => {
  it("odrzuca 1, 0 i powyżej limitu; akceptuje 2", () => {
    expect(assertPackagingUnits(1).ok).toBe(false);
    expect(assertPackagingUnits(0).ok).toBe(false);
    expect(assertPackagingUnits(100_001).ok).toBe(false);
    expect(assertPackagingUnits(100_001)).toMatchObject({
      ok: false,
      message: expect.stringContaining("100 000"),
    });
    expect(assertPackagingUnits(2)).toEqual({ ok: true, units: 2 });
    expect(assertPackagingUnits(100_000)).toEqual({
      ok: true,
      units: 100_000,
    });
  });

  it("piecesArrivingForZdUnits: A × N, B identity — bez M", () => {
    expect(piecesArrivingForZdUnits(2, 10)).toBe(20);
    expect(piecesArrivingForZdUnits(2, 10, "packages")).toBe(20);
    expect(piecesArrivingForZdUnits(2, 48)).toBe(96);
    expect(piecesArrivingForZdUnits(10, 5, "pieces_multiple")).toBe(10);
    expect(piecesArrivingForZdUnits(0, 10)).toBe(0);
    expect(piecesArrivingForZdUnits(5, 1)).toBe(5);
  });

  it("zdDocumentUnitsToPieces: B bez × N", async () => {
    const { zdDocumentUnitsToPieces } = await import(
      "./zd-estimate-units"
    );
    expect(zdDocumentUnitsToPieces(10, 5, "packages")).toBe(50);
    expect(zdDocumentUnitsToPieces(10, 5, "pieces_multiple")).toBe(10);
  });

  it("packagingRowsToRefreshLookup: N + tryb + M", () => {
    const map = packagingRowsToRefreshLookup([
      {
        subiektTwId: 7,
        unitsPerPackage: 10,
        documentUnitMode: "pieces_multiple",
        orderMultiple: 10, // Mode B — strip M
      },
      {
        subiektTwId: 8,
        unitsPerPackage: 48,
        documentUnitMode: "packages",
        orderMultiple: 10,
      },
    ]);
    expect(map.get(7)).toEqual({
      unitsPerPackage: 10,
      documentUnitMode: "pieces_multiple",
      orderMultiple: null,
    });
    expect(map.get(8)).toEqual({
      unitsPerPackage: 48,
      documentUnitMode: "packages",
      orderMultiple: 10,
    });
  });

  it("assertOrderMultiple + isZdUnitsMultipleOfOrderMultiple", () => {
    expect(assertOrderMultiple(null)).toEqual({
      ok: true,
      orderMultiple: null,
    });
    expect(assertOrderMultiple("")).toEqual({
      ok: true,
      orderMultiple: null,
    });
    expect(assertOrderMultiple(1)).toEqual({
      ok: true,
      orderMultiple: null,
    });
    expect(assertOrderMultiple(10)).toEqual({
      ok: true,
      orderMultiple: 10,
    });
    expect(assertOrderMultiple(100_001).ok).toBe(false);
    expect(isZdUnitsMultipleOfOrderMultiple(10, 10)).toBe(true);
    expect(isZdUnitsMultipleOfOrderMultiple(3, 10)).toBe(false);
    expect(isZdUnitsMultipleOfOrderMultiple(0, 10)).toBe(true);
    expect(isZdUnitsMultipleOfOrderMultiple(7, null)).toBe(true);
  });

  it("formatZdPackDocumentLabel / roundup / hint ze trim label", () => {
    const plain = computeZdPackOrderQty(5, 1);
    expect(formatZdPackDocumentLabel(plain)).toBeNull();
    expect(formatZdPackRoundupLine(plain)).toBeNull();
    const exact = computeZdPackOrderQty(20, 10, "  op.  ");
    expect(formatZdPackRoundupLine(exact)).toBeNull();
    expect(formatZdPackDocumentLabel(exact)).toBe("2 op.");
    expect(formatZdPackHint(exact)).toBe("2 op. × 10 = 20 szt");
    const round = computeZdPackOrderQty(9, 10, "karton");
    expect(formatZdPackHint(round)).toContain("1 karton × 10 = 10 szt");
    expect(formatZdPackHint(round)).toContain("potrzeba 9 szt");
  });

  it("formatZdPackOrderPreviewLine: A paczki, B sztuki", () => {
    const a = computeZdPackOrderQty(8, 5, "op.", "packages");
    expect(formatZdPackOrderPreviewLine(a)).toBe("2 × 5 = 10 szt");
    const b = computeZdPackOrderQty(8, 5, "op.", "pieces_multiple");
    expect(formatZdPackOrderPreviewLine(b)).toBe(
      "10 szt (wielokrotność 5)"
    );
  });

  it("getZdPackRoundupInfo / formatZdPackRoundupLine", () => {
    const round = computeZdPackOrderQty(1, 5, "op.", "pieces_multiple");
    expect(getZdPackRoundupInfo(round)).toEqual({
      extra: 4,
      need: 1,
      arrive: 5,
      packsBefore: null,
      packsAfter: null,
    });
    expect(formatZdPackRoundupLine(round)).toBe("dobicie +4 szt (1→5)");
    expect(getZdPackRoundupInfo(computeZdPackOrderQty(5, 5))).toBeNull();

    const packMult = computeZdPackOrderQty(144, 48, "op.", "packages", 10);
    expect(getZdPackRoundupInfo(packMult)).toMatchObject({
      packsBefore: 3,
      packsAfter: 10,
    });
    expect(formatZdPackRoundupLine(packMult)).toBe("3→10 op.");
  });
});

describe("resolveOrderQtyForLine + para", () => {
  it("używa doZamowieniaReczne i ratio pary — bez podwójnego × packaging", () => {
    const q = resolveOrderQtyForLine(
      {
        tw_Id: 10,
        tw_Symbol: "P",
        tw_Nazwa: "P",
        tw_IdGrupa: null,
        grt_Nazwa: "—",
        tw_Stan: 0,
        tw_StanRez: 0,
        dostepne: 0,
        sprzedazOkres: 0,
   wzNiepowiazaneOkres: 0,
      sprzedazDziennie: 0,
        celZapasu: 500,
        celZapasuTracked: 500,
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
        doZamowieniaReczne: 50,
        wkladZk: 0,
        pair: {
          role: "pack",
          twinTwId: 20,
          unitsPerPack: 100,
          sprzedazSzt: 50,
          wzNiepowiazaneSzt: 0,
          coverSzt: 0,
          pieceSprzedaz: 50,
          packSprzedaz: 0,
          pieceWzNiepowiazane: 0,
          packWzNiepowiazane: 0,
          pieceDostepne: 0,
          packDostepne: 0,
        },
      },
      { unitsPerPackage: 50, packageLabel: "op." } // konflikt DB — ignorowany
    );
    expect(q.piecesNeeded).toBe(50);
    expect(q.unitsPerPackage).toBe(100);
    expect(q.zdUnits).toBe(1);
    expect(q.piecesArriving).toBe(100);
  });

  it("para pack + orderMultiple M — dobija paczki", () => {
    const q = resolveOrderQtyForLine(
      {
        tw_Id: 10,
        tw_Symbol: "P",
        tw_Nazwa: "P",
        tw_IdGrupa: null,
        grt_Nazwa: "—",
        tw_Stan: 0,
        tw_StanRez: 0,
        dostepne: 0,
        sprzedazOkres: 0,
        wzNiepowiazaneOkres: 0,
        sprzedazDziennie: 0,
        celZapasu: 144,
        celZapasuTracked: 144,
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
        doZamowieniaReczne: 144,
        wkladZk: 0,
        pair: {
          role: "pack",
          twinTwId: 20,
          unitsPerPack: 48,
          sprzedazSzt: 0,
          wzNiepowiazaneSzt: 0,
          coverSzt: 0,
          pieceSprzedaz: 0,
          packSprzedaz: 0,
          pieceWzNiepowiazane: 0,
          packWzNiepowiazane: 0,
          pieceDostepne: 0,
          packDostepne: 0,
        },
      },
      {
        unitsPerPackage: 48,
        packageLabel: "op.",
        orderMultiple: 10,
      }
    );
    expect(q.zdUnits).toBe(10);
    expect(q.packsBeforeOrderMultiple).toBe(3);
    expect(q.piecesArriving).toBe(480);
  });

  it("piece w parze → zdUnits 0 (TSV / orderable)", () => {
    const q = resolveOrderQtyForLine({
      tw_Id: 20,
      tw_Symbol: "PC",
      tw_Nazwa: "PC",
      tw_IdGrupa: null,
      grt_Nazwa: "—",
      tw_Stan: 0,
      tw_StanRez: 0,
      dostepne: 0,
      sprzedazOkres: 50,
      wzNiepowiazaneOkres: 0,
      sprzedazDziennie: 0,
      celZapasu: 50,
      celZapasuTracked: 50,
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
      pair: {
        role: "piece",
        twinTwId: 10,
        unitsPerPack: 100,
        sprzedazSzt: 50,
        wzNiepowiazaneSzt: 0,
        coverSzt: 0,
        pieceSprzedaz: 50,
        packSprzedaz: 0,
        pieceWzNiepowiazane: 0,
        packWzNiepowiazane: 0,
        pieceDostepne: 0,
        packDostepne: 0,
      },
    });
    expect(q.zdUnits).toBe(0);
  });

  it("override na piece / BOM parent jest ignorowany (nie wchodzi na ZD)", () => {
    const piece = {
      tw_Id: 20,
      tw_Symbol: "PC",
      tw_Nazwa: "PC",
      tw_IdGrupa: null,
      grt_Nazwa: "—",
      tw_Stan: 0,
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
      pair: {
        role: "piece" as const,
        twinTwId: 10,
        unitsPerPack: 100,
        sprzedazSzt: 0,
        wzNiepowiazaneSzt: 0,
        coverSzt: 0,
        pieceSprzedaz: 0,
        packSprzedaz: 0,
        pieceWzNiepowiazane: 0,
        packWzNiepowiazane: 0,
        pieceDostepne: 0,
        packDostepne: 0,
      },
    } as ManualZdEstimateLine;
    expect(lineAllowsZdDocumentUnitOverride(piece)).toBe(false);
    expect(effectiveZdDocumentUnits(piece, null, 0, 99)).toBe(0);

    const parent = {
      ...piece,
      tw_Id: 30,
      pair: null,
      bom: { role: "assembled_parent" as const, parentTwIds: [30] },
    } as ManualZdEstimateLine;
    expect(lineAllowsZdDocumentUnitOverride(parent)).toBe(false);
    expect(effectiveZdDocumentUnits(parent, null, 0, 5)).toBe(0);

    const blocked = {
      ...piece,
      tw_Id: 40,
      pair: null,
      bom: {
        role: "component" as const,
        purchaseBlocked: true,
        parentTwIds: [30],
      },
    } as ManualZdEstimateLine;
    expect(lineAllowsZdDocumentUnitOverride(blocked)).toBe(false);
    expect(resolveOrderQtyForLine(blocked).zdUnits).toBe(0);
    // Extras z explode próśb mogą wejść mimo purchaseBlocked.
    expect(resolveOrderQtyForLine(blocked, null, 8).zdUnits).toBe(8);

    const purchased = {
      ...piece,
      tw_Id: 50,
      pair: null,
      doZamowieniaReczne: 8,
      celZapasu: 8,
      celZapasuTracked: 8,
      bom: {
        role: "purchased_kit" as const,
        purchaseTarget: "as_sold" as const,
      },
    } as ManualZdEstimateLine;
    expect(lineAllowsZdDocumentUnitOverride(purchased)).toBe(true);
    expect(resolveOrderQtyForLine(purchased).zdUnits).toBeGreaterThan(0);

    const pruned = pruneZdDocumentUnitOverrides(
      { 20: 99, 30: 5 },
      [piece, parent],
      new Map()
    );
    expect(pruned).toEqual({});
  });
});

describe("resolveOrderQtyForLine", () => {
  it("otwarte ZD w paczkach odejmuje sztuki × opakowanie", () => {
    const line = mapZdEstimateLineToManual({
      tw_Id: 1,
      tw_Symbol: "DO.6312.03",
      tw_Nazwa: "Falcon",
      celZapasu: 40,
      dostepne: 10,
      otwarteZd: 2, // 2 op. już na ZD = 20 szt
      doZamowienia: 100,
    });
    // pieces = ceil(40 - 10 - 20) = 10 → 1 op.
    const q = resolveOrderQtyForLine(line, {
      unitsPerPackage: 10,
      packageLabel: "op.",
    });
    expect(q.piecesNeeded).toBe(10);
    expect(q.zdUnits).toBe(1);
    expect(q.piecesArriving).toBe(10);
  });

  it("bez opakowania nie mnoży otwartych ZD", () => {
    const line = mapZdEstimateLineToManual({
      tw_Id: 2,
      tw_Symbol: "X",
      tw_Nazwa: "x",
      celZapasu: 40,
      dostepne: 10,
      otwarteZd: 5,
      doZamowienia: 100,
    });
    const q = resolveOrderQtyForLine(line, null);
    expect(q.piecesNeeded).toBe(25);
    expect(q.zdUnits).toBe(25);
    expect(q.hasPackaging).toBe(false);
  });
});

describe("summarizePackOrderQty", () => {
  it("sumuje jednostki ZD z opakowań", () => {
    const lines = [
      mapZdEstimateLineToManual({
        tw_Id: 1,
        tw_Symbol: "A",
        tw_Nazwa: "a",
        celZapasu: 25,
        dostepne: 5,
        otwarteZd: 0,
        doZamowienia: 20,
      }),
      mapZdEstimateLineToManual({
        tw_Id: 2,
        tw_Symbol: "B",
        tw_Nazwa: "b",
        celZapasu: 8,
        dostepne: 0,
        otwarteZd: 0,
        doZamowienia: 8,
      }),
    ];
    const pack = new Map([
      [1, { unitsPerPackage: 10, packageLabel: "op." }],
    ]);
    const s = summarizePackOrderQty(lines, pack);
    // A: 20 szt → 2 op. (20); B: 8 szt 1:1
    expect(s.doZamowieniaCount).toBe(2);
    expect(s.zdUnitsSuma).toBe(2 + 8);
    expect(s.piecesArrivingSuma).toBe(20 + 8);
  });
});

describe("resolveOrderQtyForLine + individualExtra", () => {
  it("solo + individualExtra podbija pieces przed opakowaniem", () => {
    const line = mapZdEstimateLineToManual({
      tw_Id: 1,
      tw_Symbol: "DO.6312.03",
      tw_Nazwa: "Falcon",
      celZapasu: 10,
      dostepne: 10,
      otwarteZd: 0,
      doZamowienia: 0,
    });
    // base 0 + extra 8 → 1 op.
    const q = resolveOrderQtyForLine(
      line,
      { unitsPerPackage: 10, packageLabel: "op." },
      8
    );
    expect(q.piecesNeeded).toBe(8);
    expect(q.zdUnits).toBe(1);
  });

  it("extrasPolicy max: nie dubluje gdy extra < need", () => {
    const line = mapZdEstimateLineToManual(
      {
        tw_Id: 1,
        tw_Symbol: "X",
        tw_Nazwa: "x",
        celZapasu: 40,
        dostepne: 10,
        otwarteZd: 0,
        doZamowienia: 30,
        sprzedazOkres: 0,
   wzNiepowiazaneOkres: 0,
      sprzedazDziennie: 0,
      },
      { salesTrack: false }
    );
    const pack = { unitsPerPackage: 1, packageLabel: "szt" };
    const sum = resolveOrderQtyForLine(line, pack, 8, false, "sum");
    const max = resolveOrderQtyForLine(line, pack, 8, false, "max");
    expect(sum.piecesNeeded).toBe(38);
    expect(max.piecesNeeded).toBe(30);
  });

  it("pack + partnerMissing + extra → zdUnits > 0", () => {
    const q = resolveOrderQtyForLine(
      {
        tw_Id: 10,
        tw_Symbol: "P",
        tw_Nazwa: "P",
        tw_IdGrupa: null,
        grt_Nazwa: "—",
        tw_Stan: 0,
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
        pair: {
          role: "pack",
          twinTwId: 20,
          unitsPerPack: 10,
          sprzedazSzt: 0,
          wzNiepowiazaneSzt: 0,
          coverSzt: 0,
          pieceSprzedaz: 0,
          packSprzedaz: 0,
          pieceWzNiepowiazane: 0,
          packWzNiepowiazane: 0,
          pieceDostepne: 0,
          packDostepne: 0,
          partnerMissing: true,
        },
      },
      null,
      15
    );
    expect(q.piecesNeeded).toBe(15);
    expect(q.zdUnits).toBe(2);
    expect(q.piecesArriving).toBe(20);
  });

  it("piece + extra nadal zdUnits 0", () => {
    const q = resolveOrderQtyForLine(
      {
        tw_Id: 20,
        tw_Symbol: "PC",
        tw_Nazwa: "PC",
        tw_IdGrupa: null,
        grt_Nazwa: "—",
        tw_Stan: 0,
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
        pair: {
          role: "piece",
          twinTwId: 10,
          unitsPerPack: 100,
          sprzedazSzt: 0,
          wzNiepowiazaneSzt: 0,
          coverSzt: 0,
          pieceSprzedaz: 0,
          packSprzedaz: 0,
          pieceWzNiepowiazane: 0,
          packWzNiepowiazane: 0,
          pieceDostepne: 0,
          packDostepne: 0,
        },
      },
      null,
      50
    );
    expect(q.zdUnits).toBe(0);
  });
});

describe("resolveOrderQtyForLine + BOM parent", () => {
  it("parent BOM → zdUnits 0", () => {
    const q = resolveOrderQtyForLine({
      tw_Id: 99,
      tw_Symbol: "PROMO",
      tw_Nazwa: "Promo",
      tw_IdGrupa: null,
      grt_Nazwa: "—",
      tw_Stan: 0,
      tw_StanRez: 0,
      dostepne: 0,
      sprzedazOkres: 5,
     wzNiepowiazaneOkres: 0,
      sprzedazDziennie: 0,
      celZapasu: 5,
      celZapasuTracked: 5,
      salesTrackDelta: 0,
      salesTrackReasons: [],
      salesTrackConfidence: 0,
      salesTrackQtyReview: false,
      salesTrackHeldExtraQty: 0,
      salesTrackAllowedExtraQty: 0,
      otwarteZkBezRez: 0,
      otwarteZkZarezerwowane: 0,
      otwarteZd: 0,
      doZamowieniaApi: 5,
      doZamowieniaReczne: 0,
      wkladZk: 0,
      bom: { role: "assembled_parent" },
    });
    expect(q.zdUnits).toBe(0);
  });
});

describe("effectiveZdDocumentUnits + override w summary/filter", () => {
  const baseLine = {
    tw_Id: 7,
    tw_Symbol: "X",
    tw_Nazwa: "X",
    tw_IdGrupa: null,
    grt_Nazwa: "—",
    tw_Stan: 0,
    tw_StanRez: 0,
    dostepne: 0,
    sprzedazOkres: 0,
   wzNiepowiazaneOkres: 0,
      sprzedazDziennie: 0,
    celZapasu: 8,
    celZapasuTracked: 8,
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
    doZamowieniaReczne: 8,
    wkladZk: 0,
  } as ManualZdEstimateLine;

  it("override zastępuje wyliczone jednostki dokumentu", () => {
    expect(
      effectiveZdDocumentUnits(baseLine, { unitsPerPackage: 10 }, null, 3)
    ).toBe(3);
    expect(
      effectiveZdDocumentUnits(baseLine, { unitsPerPackage: 10 }, null, null)
    ).toBe(1);
  });

  it("summary i filter respektują mapę override (0 wypada z Do ZD)", () => {
    const lines = [baseLine];
    const pack = new Map([[7, { unitsPerPackage: 10, packageLabel: "op." }]]);
    const overrides = new Map([[7, 0]]);
    const sum = summarizePackOrderQty(lines, pack, null, null, overrides);
    expect(sum.doZamowieniaCount).toBe(0);
    expect(sum.zdUnitsSuma).toBe(0);
    expect(
      filterOrderableLinesWithPackaging(lines, pack, null, null, overrides)
    ).toHaveLength(0);
  });

  it("pruneZdDocumentUnitOverrides usuwa równe wyliczeniu i martwe tw", () => {
    const pack = new Map([[7, { unitsPerPackage: 10, packageLabel: "op." }]]);
    const input = { 7: 1, 99: 5 };
    const pruned = pruneZdDocumentUnitOverrides(input, [baseLine], pack, null);
    expect(pruned).toEqual({});
    expect(
      pruneZdDocumentUnitOverrides({ 7: 3 }, [baseLine], pack, null)
    ).toEqual({ 7: 3 });
    const same = { 7: 3 };
    expect(pruneZdDocumentUnitOverrides(same, [baseLine], pack, null)).toBe(
      same
    );
  });
});

describe("resolveOrderQtyForLine extra_only", () => {
  it("extra_only: ignoruje cel/stan — tylko sztuki prośby + ceil opakowania", () => {
    const line = {
      tw_Id: 7,
      tw_Symbol: "X",
      tw_Nazwa: "X",
      tw_IdGrupa: null,
      grt_Nazwa: "—",
      tw_Stan: 0,
      tw_StanRez: 0,
      dostepne: 0,
      sprzedazOkres: 0,
   wzNiepowiazaneOkres: 0,
      sprzedazDziennie: 0,
      celZapasu: 500,
      celZapasuTracked: 500,
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
      doZamowieniaReczne: 500,
      wkladZk: 0,
    } as ManualZdEstimateLine;
    const q = resolveOrderQtyForLine(
      line,
      { unitsPerPackage: 10, packageLabel: "op." },
      8,
      true
    );
    expect(q.piecesNeeded).toBe(8);
    expect(q.zdUnits).toBe(1);
    expect(q.piecesArriving).toBe(10);
  });

  it("extra_only + para pack: baza 0 mimo doZamowieniaReczne; dzielnik = unitsPerPack", () => {
    const line = {
      tw_Id: 10,
      tw_Symbol: "PACK",
      tw_Nazwa: "P",
      tw_IdGrupa: null,
      grt_Nazwa: "—",
      tw_Stan: 0,
      tw_StanRez: 0,
      dostepne: 0,
      sprzedazOkres: 0,
   wzNiepowiazaneOkres: 0,
      sprzedazDziennie: 0,
      celZapasu: 5000,
      celZapasuTracked: 5000,
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
      doZamowieniaReczne: 500,
      wkladZk: 0,
      pair: {
        role: "pack" as const,
        twinTwId: 20,
        unitsPerPack: 100,
        sprzedazSzt: 0,
        wzNiepowiazaneSzt: 0,
        coverSzt: 0,
        pieceSprzedaz: 0,
        packSprzedaz: 0,
        pieceWzNiepowiazane: 0,
        packWzNiepowiazane: 0,
        pieceDostepne: 0,
        packDostepne: 0,
        partnerMissing: false,
      },
    } as ManualZdEstimateLine;
    const q = resolveOrderQtyForLine(
      line,
      { unitsPerPackage: 10, packageLabel: "op." },
      25,
      true
    );
    expect(q.piecesNeeded).toBe(25);
    expect(q.unitsPerPackage).toBe(100);
    expect(q.zdUnits).toBe(1);
    expect(q.piecesArriving).toBe(100);
  });

  it("extra_only + para pack + partnerMissing: nadal tylko extra", () => {
    const line = {
      tw_Id: 10,
      tw_Symbol: "PACK",
      tw_Nazwa: "P",
      tw_IdGrupa: null,
      grt_Nazwa: "—",
      tw_Stan: 0,
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
      pair: {
        role: "pack" as const,
        twinTwId: 20,
        unitsPerPack: 40,
        sprzedazSzt: 0,
        wzNiepowiazaneSzt: 0,
        coverSzt: 0,
        pieceSprzedaz: 0,
        packSprzedaz: 0,
        pieceWzNiepowiazane: 0,
        packWzNiepowiazane: 0,
        pieceDostepne: 0,
        packDostepne: 0,
        partnerMissing: true,
      },
    } as ManualZdEstimateLine;
    const q = resolveOrderQtyForLine(line, null, 80, true);
    expect(q.piecesNeeded).toBe(80);
    expect(q.zdUnits).toBe(2);
  });
});

describe("pruneZdDocumentUnitOverrides + extraOnly", () => {
  const baseLine = {
    tw_Id: 7,
    tw_Symbol: "X",
    tw_Nazwa: "X",
    tw_IdGrupa: null,
    grt_Nazwa: "—",
    tw_Stan: 0,
    tw_StanRez: 0,
    dostepne: 0,
    sprzedazOkres: 0,
   wzNiepowiazaneOkres: 0,
      sprzedazDziennie: 0,
    celZapasu: 500,
    celZapasuTracked: 500,
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
    doZamowieniaReczne: 500,
    wkladZk: 0,
  } as ManualZdEstimateLine;

  it("usuwa override równy wyliczeniu extra_only", () => {
    const pack = new Map([
      [7, { unitsPerPackage: 10, packageLabel: "op." }],
    ]);
    const extras = new Map([[7, 8]]);
    const extraOnly = new Set([7]);
    // ceil(8/10)=1
    const pruned = pruneZdDocumentUnitOverrides(
      { 7: 1 },
      [baseLine],
      pack,
      extras,
      extraOnly
    );
    expect(pruned).toEqual({});
  });

  it("zostawia override różne od extra_only", () => {
    const pack = new Map([
      [7, { unitsPerPackage: 10, packageLabel: "op." }],
    ]);
    const pruned = pruneZdDocumentUnitOverrides(
      { 7: 5 },
      [baseLine],
      pack,
      new Map([[7, 8]]),
      new Set([7])
    );
    expect(pruned).toEqual({ 7: 5 });
  });
});

describe("filterOrderableLinesWithPackaging + extraOnly", () => {
  it("soft orderExcluded poza listą; lifted zostaje z qty z extra", () => {
    const soft = {
      tw_Id: 1,
      tw_Symbol: "S",
      tw_Nazwa: "soft",
      tw_IdGrupa: null,
      grt_Nazwa: "—",
      tw_Stan: 0,
      tw_StanRez: 0,
      dostepne: 0,
      sprzedazOkres: 0,
   wzNiepowiazaneOkres: 0,
      sprzedazDziennie: 0,
      celZapasu: 100,
      celZapasuTracked: 100,
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
      doZamowieniaReczne: 50,
      wkladZk: 0,
    } as ManualZdEstimateLine;
    const lifted = { ...soft, tw_Id: 2, tw_Symbol: "L" } as ManualZdEstimateLine;
    const pack = new Map([
      [1, { unitsPerPackage: 10, packageLabel: "op." }],
      [2, { unitsPerPackage: 10, packageLabel: "op." }],
    ]);
    const orderExcluded = new Set([1]);
    const extras = new Map([[2, 12]]);
    const extraOnly = new Set([2]);
    const rows = filterOrderableLinesWithPackaging(
      [soft, lifted],
      pack,
      orderExcluded,
      extras,
      null,
      extraOnly
    );
    expect(rows.map((r) => r.tw_Id)).toEqual([2]);
  });
});
