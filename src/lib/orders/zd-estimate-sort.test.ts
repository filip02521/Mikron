import { describe, expect, it } from "vitest";
import { mapZdEstimateLineToManual } from "./zd-estimate-manual";
import {
  defaultDirForZdEstimateSortKey,
  sortZdEstimateLines,
} from "./zd-estimate-sort";

function line(partial: {
  tw_Id: number;
  tw_Symbol: string;
  tw_Nazwa: string;
  celZapasu: number;
  dostepne?: number;
  otwarteZd?: number;
}) {
  return mapZdEstimateLineToManual(
    {
      tw_Id: partial.tw_Id,
      tw_Symbol: partial.tw_Symbol,
      tw_Nazwa: partial.tw_Nazwa,
      celZapasu: partial.celZapasu,
      dostepne: partial.dostepne ?? 0,
      otwarteZd: partial.otwarteZd ?? 0,
      doZamowienia: partial.celZapasu,
      sprzedazOkres: 0,
      sprzedazDziennie: 0,
    },
    { salesTrack: false }
  );
}

describe("sortZdEstimateLines", () => {
  const rows = [
    line({ tw_Id: 1, tw_Symbol: "B-2", tw_Nazwa: "Zebra", celZapasu: 5 }),
    line({ tw_Id: 2, tw_Symbol: "A-10", tw_Nazwa: "Alpha", celZapasu: 20 }),
    line({ tw_Id: 3, tw_Symbol: "A-2", tw_Nazwa: "Beta", celZapasu: 10 }),
  ];

  it("sortuje po symbolu numerycznie (pl)", () => {
    const sorted = sortZdEstimateLines(rows, "symbol", "asc");
    expect(sorted.map((r) => r.tw_Symbol)).toEqual(["A-2", "A-10", "B-2"]);
  });

  it("sortuje po nazwie", () => {
    const sorted = sortZdEstimateLines(rows, "name", "asc");
    expect(sorted.map((r) => r.tw_Nazwa)).toEqual(["Alpha", "Beta", "Zebra"]);
  });

  it("sortuje Do ZD malejąco (jednostki dokumentu)", () => {
    const sorted = sortZdEstimateLines(rows, "doZd", "desc");
    expect(sorted.map((r) => r.tw_Id)).toEqual([2, 3, 1]);
  });

  it("Do ZD uwzględnia opakowanie", () => {
    // 8 szt → 1 op. przy ×10; 25 szt → 3 op.
    const packed = [
      line({ tw_Id: 1, tw_Symbol: "X", tw_Nazwa: "x", celZapasu: 8 }),
      line({ tw_Id: 2, tw_Symbol: "Y", tw_Nazwa: "y", celZapasu: 25 }),
    ];
    const pack = new Map([
      [1, { unitsPerPackage: 10, packageLabel: "op." }],
      [2, { unitsPerPackage: 10, packageLabel: "op." }],
    ]);
    const sorted = sortZdEstimateLines(packed, "doZd", "desc", pack);
    expect(sorted.map((r) => r.tw_Id)).toEqual([2, 1]);
  });

  it("Do ZD respektuje override jednostek", () => {
    const packed = [
      line({ tw_Id: 1, tw_Symbol: "X", tw_Nazwa: "x", celZapasu: 8 }),
      line({ tw_Id: 2, tw_Symbol: "Y", tw_Nazwa: "y", celZapasu: 25 }),
    ];
    const pack = new Map([
      [1, { unitsPerPackage: 10, packageLabel: "op." }],
      [2, { unitsPerPackage: 10, packageLabel: "op." }],
    ]);
    const overrides = new Map([
      [1, 9],
      [2, 1],
    ]);
    const sorted = sortZdEstimateLines(
      packed,
      "doZd",
      "desc",
      pack,
      null,
      overrides
    );
    expect(sorted.map((r) => r.tw_Id)).toEqual([1, 2]);
  });

  it("nie mutuje wejścia", () => {
    const copy = [...rows];
    sortZdEstimateLines(rows, "name", "asc");
    expect(rows.map((r) => r.tw_Id)).toEqual(copy.map((r) => r.tw_Id));
  });
});

describe("defaultDirForZdEstimateSortKey", () => {
  it("Do ZD domyślnie desc, tekst asc", () => {
    expect(defaultDirForZdEstimateSortKey("doZd")).toBe("desc");
    expect(defaultDirForZdEstimateSortKey("symbol")).toBe("asc");
    expect(defaultDirForZdEstimateSortKey("name")).toBe("asc");
  });
});
