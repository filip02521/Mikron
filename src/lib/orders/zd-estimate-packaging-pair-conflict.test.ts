import { describe, expect, it } from "vitest";
import {
  collectZdPackagingPairConflicts,
  formatZdPackagingPairConflictHint,
} from "./zd-estimate-packaging-pair-conflict";
import type { ManualZdEstimateLine } from "./zd-estimate-manual";

function line(
  partial: Partial<ManualZdEstimateLine> & Pick<ManualZdEstimateLine, "tw_Id">
): ManualZdEstimateLine {
  return {
    tw_Symbol: "SYM",
    tw_Nazwa: "Nazwa",
    tw_IdGrupa: 1,
    grt_Nazwa: "G",
    tw_Zablokowany: false,
    sprzedazOkres: 0,
    sredniaDzienna: 0,
    celZapasu: 0,
    dostepne: 0,
    otwarteZd: 0,
    doZamowieniaReczne: 1,
    ...partial,
  } as ManualZdEstimateLine;
}

describe("collectZdPackagingPairConflicts", () => {
  it("wykrywa rozjazd opakowanie vs para na roli pack", () => {
    const lines = [
      line({
        tw_Id: 1,
        tw_Symbol: "PACK",
        pair: {
          role: "pack",
          twinTwId: 2,
          unitsPerPack: 100,
          sprzedazSzt: 0,
          coverSzt: 0,
          pieceSprzedaz: 0,
          packSprzedaz: 0,
          pieceDostepne: 0,
          packDostepne: 0,
        },
      }),
    ];
    const pack = new Map([[1, { unitsPerPackage: 10 }]]);
    expect(collectZdPackagingPairConflicts(lines, pack)).toEqual([
      {
        twId: 1,
        symbol: "PACK",
        nazwa: "Nazwa",
        packagingUnits: 10,
        pairUnitsPerPack: 100,
      },
    ]);
  });

  it("wykrywa też opakowanie 1 vs para >1", () => {
    const lines = [
      line({
        tw_Id: 1,
        tw_Symbol: "PACK",
        pair: {
          role: "pack",
          twinTwId: 2,
          unitsPerPack: 100,
          sprzedazSzt: 0,
          coverSzt: 0,
          pieceSprzedaz: 0,
          packSprzedaz: 0,
          pieceDostepne: 0,
          packDostepne: 0,
        },
      }),
    ];
    expect(
      collectZdPackagingPairConflicts(lines, new Map([[1, { unitsPerPackage: 1 }]]))
    ).toHaveLength(1);
  });

  it("pomija wykluczone gdy podano excludedTwIds", () => {
    const lines = [
      line({
        tw_Id: 1,
        tw_Symbol: "PACK",
        pair: {
          role: "pack",
          twinTwId: 2,
          unitsPerPack: 100,
          sprzedazSzt: 0,
          coverSzt: 0,
          pieceSprzedaz: 0,
          packSprzedaz: 0,
          pieceDostepne: 0,
          packDostepne: 0,
        },
      }),
    ];
    expect(
      collectZdPackagingPairConflicts(
        lines,
        new Map([[1, { unitsPerPackage: 10 }]]),
        new Set([1])
      )
    ).toEqual([]);
  });

  it("soft on-request (orderExcluded) pomija konflikt; lifted (poza setem) nadal blokuje", () => {
    const soft = line({
      tw_Id: 1,
      tw_Symbol: "SOFT",
      pair: {
        role: "pack",
        twinTwId: 2,
        unitsPerPack: 100,
        sprzedazSzt: 0,
        coverSzt: 0,
        pieceSprzedaz: 0,
        packSprzedaz: 0,
        pieceDostepne: 0,
        packDostepne: 0,
      },
    });
    const lifted = line({
      tw_Id: 3,
      tw_Symbol: "LIFT",
      pair: {
        role: "pack",
        twinTwId: 4,
        unitsPerPack: 100,
        sprzedazSzt: 0,
        coverSzt: 0,
        pieceSprzedaz: 0,
        packSprzedaz: 0,
        pieceDostepne: 0,
        packDostepne: 0,
      },
    });
    const pack = new Map([
      [1, { unitsPerPackage: 10 }],
      [3, { unitsPerPackage: 10 }],
    ]);
    // Soft w orderExcluded; lifted (extraOnly) nie.
    const orderExcluded = new Set([1]);
    const conflicts = collectZdPackagingPairConflicts(
      [soft, lifted],
      pack,
      orderExcluded
    );
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.twId).toBe(3);
  });
});

describe("formatZdPackagingPairConflictHint", () => {
  it("formatuje skrót", () => {
    expect(
      formatZdPackagingPairConflictHint({
        twId: 1,
        symbol: "A",
        nazwa: "n",
        packagingUnits: 10,
        pairUnitsPerPack: 100,
      })
    ).toBe("A: opakowanie 10 ≠ para 100");
  });
});
