import { describe, expect, it } from "vitest";
import {
  mapZdEstimateLineToManual,
  type ManualZdEstimateLine,
} from "./zd-estimate-manual";
import {
  computeZdPackOrderQty,
  effectiveZdDocumentUnits,
  filterOrderableLinesWithPackaging,
  formatZdPackHint,
  lineAllowsZdDocumentUnitOverride,
  pruneZdDocumentUnitOverrides,
  resolveOrderQtyForLine,
  summarizePackOrderQty,
} from "./zd-estimate-packaging";

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
        sprzedazDziennie: 0,
        celZapasu: 500,
        celZapasuTracked: 500,
        salesTrackDelta: 0,
        salesTrackReasons: [],
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
          coverSzt: 0,
          pieceSprzedaz: 50,
          packSprzedaz: 0,
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
      sprzedazDziennie: 0,
      celZapasu: 50,
      celZapasuTracked: 50,
      salesTrackDelta: 0,
      salesTrackReasons: [],
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
        coverSzt: 0,
        pieceSprzedaz: 50,
        packSprzedaz: 0,
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
      pair: {
        role: "piece" as const,
        twinTwId: 10,
        unitsPerPack: 100,
        sprzedazSzt: 0,
        coverSzt: 0,
        pieceSprzedaz: 0,
        packSprzedaz: 0,
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
      bom: { role: "parent" as const, parentTwIds: [30] },
    } as ManualZdEstimateLine;
    expect(lineAllowsZdDocumentUnitOverride(parent)).toBe(false);
    expect(effectiveZdDocumentUnits(parent, null, 0, 5)).toBe(0);

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
        pair: {
          role: "pack",
          twinTwId: 20,
          unitsPerPack: 10,
          sprzedazSzt: 0,
          coverSzt: 0,
          pieceSprzedaz: 0,
          packSprzedaz: 0,
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
        pair: {
          role: "piece",
          twinTwId: 10,
          unitsPerPack: 100,
          sprzedazSzt: 0,
          coverSzt: 0,
          pieceSprzedaz: 0,
          packSprzedaz: 0,
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
      sprzedazDziennie: 0,
      celZapasu: 5,
      celZapasuTracked: 5,
      salesTrackDelta: 0,
      salesTrackReasons: [],
      otwarteZkBezRez: 0,
      otwarteZkZarezerwowane: 0,
      otwarteZd: 0,
      doZamowieniaApi: 5,
      doZamowieniaReczne: 0,
      wkladZk: 0,
      bom: { role: "parent" },
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
    sprzedazDziennie: 0,
    celZapasu: 8,
    celZapasuTracked: 8,
    salesTrackDelta: 0,
    salesTrackReasons: [],
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
      sprzedazDziennie: 0,
      celZapasu: 500,
      celZapasuTracked: 500,
      salesTrackDelta: 0,
      salesTrackReasons: [],
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
      sprzedazDziennie: 0,
      celZapasu: 5000,
      celZapasuTracked: 5000,
      salesTrackDelta: 0,
      salesTrackReasons: [],
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
        coverSzt: 0,
        pieceSprzedaz: 0,
        packSprzedaz: 0,
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
      pair: {
        role: "pack" as const,
        twinTwId: 20,
        unitsPerPack: 40,
        sprzedazSzt: 0,
        coverSzt: 0,
        pieceSprzedaz: 0,
        packSprzedaz: 0,
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
    sprzedazDziennie: 0,
    celZapasu: 500,
    celZapasuTracked: 500,
    salesTrackDelta: 0,
    salesTrackReasons: [],
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
      sprzedazDziennie: 0,
      celZapasu: 100,
      celZapasuTracked: 100,
      salesTrackDelta: 0,
      salesTrackReasons: [],
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
