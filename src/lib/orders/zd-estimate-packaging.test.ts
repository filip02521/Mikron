import { describe, expect, it } from "vitest";
import { mapZdEstimateLineToManual } from "./zd-estimate-manual";
import {
  computeZdPackOrderQty,
  formatZdPackHint,
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
