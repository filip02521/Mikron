import { describe, expect, it } from "vitest";
import {
  coerceZdEstimateLinesBase,
  zdEstimateLinesLookMerged,
} from "./zd-estimate-lines-base";
import type { ManualZdEstimateLine } from "./zd-estimate-manual";

function line(
  partial: Partial<ManualZdEstimateLine> & Pick<ManualZdEstimateLine, "tw_Id">
): ManualZdEstimateLine {
  return {
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
    celZapasu: 0,
    celZapasuTracked: 0,
    salesTrackDelta: 0,
    salesTrackReasons: [],
    salesTrackConfidence: 0,
    salesTrackQtyReview: false,
    salesTrackHeldExtraQty: 0,
    salesTrackAllowedExtraQty: 0,
    otwarteZd: 0,
    otwarteZkBezRez: 0,
    otwarteZkZarezerwowane: 0,
    doZamowieniaApi: 0,
    doZamowieniaReczne: 0,
    wkladZk: 0,
    pair: null,
    bom: null,
    ...partial,
  };
}

describe("coerceZdEstimateLinesBase", () => {
  it("plain lines — kopia bez merge flag", () => {
    const rows = [line({ tw_Id: 1, sprzedazOkres: 9 })];
    expect(zdEstimateLinesLookMerged(rows)).toBe(false);
    const out = coerceZdEstimateLinesBase(rows);
    expect(out[0]!.sprzedazOkres).toBe(9);
    expect(out[0]!.pair).toBeNull();
  });

  it("para: odzyskuje pack/piece kanały (nie merged sprzedazSzt)", () => {
    const rows = [
      line({
        tw_Id: 10,
        sprzedazOkres: 140,
        pair: {
          role: "pack",
          twinTwId: 20,
          unitsPerPack: 100,
          sprzedazSzt: 140,
          wzNiepowiazaneSzt: 2,
          coverSzt: 0,
          pieceSprzedaz: 40,
          packSprzedaz: 1,
          pieceWzNiepowiazane: 2,
          packWzNiepowiazane: 0,
          pieceDostepne: 0,
          packDostepne: 0,
        },
      }),
      line({
        tw_Id: 20,
        sprzedazOkres: 0,
        pair: {
          role: "piece",
          twinTwId: 10,
          unitsPerPack: 100,
          sprzedazSzt: 140,
          wzNiepowiazaneSzt: 2,
          coverSzt: 0,
          pieceSprzedaz: 40,
          packSprzedaz: 1,
          pieceWzNiepowiazane: 2,
          packWzNiepowiazane: 0,
          pieceDostepne: 0,
          packDostepne: 0,
        },
      }),
    ];
    expect(zdEstimateLinesLookMerged(rows)).toBe(true);
    const out = coerceZdEstimateLinesBase(rows);
    expect(out.find((l) => l.tw_Id === 10)!.sprzedazOkres).toBe(1);
    expect(out.find((l) => l.tw_Id === 20)!.sprzedazOkres).toBe(40);
    expect(out.every((l) => l.pair == null && l.bom == null)).toBe(true);
  });

  it("BOM component: odejmuje contributionSales/Cover", () => {
    const rows = [
      line({
        tw_Id: 1,
        sprzedazOkres: 0,
        bom: { role: "assembled_parent", relocatedSales: 5, relocatedWz: 0 },
      }),
      line({
        tw_Id: 2,
        sprzedazOkres: 12,
        dostepne: 8,
        bom: {
          role: "component",
          contributionSales: 10,
          contributionWz: 0,
          contributionCover: 3,
          parentTwIds: [1],
        },
      }),
    ];
    const out = coerceZdEstimateLinesBase(rows);
    expect(out.find((l) => l.tw_Id === 1)!.sprzedazOkres).toBe(5);
    expect(out.find((l) => l.tw_Id === 2)!.sprzedazOkres).toBe(2);
    expect(out.find((l) => l.tw_Id === 2)!.dostepne).toBe(5);
  });

  it("pair + bom component: odejmuje wkład od kanału pary (Castorit pack)", () => {
    const rows = [
      line({
        tw_Id: 3,
        sprzedazOkres: 130,
        dostepne: 10,
        pair: {
          role: "pack",
          twinTwId: 2,
          unitsPerPack: 40,
          sprzedazSzt: 130,
          wzNiepowiazaneSzt: 0,
          coverSzt: 10,
          pieceSprzedaz: 10,
          packSprzedaz: 3, // już po BOM (1 własne + 2 wkład)
          pieceWzNiepowiazane: 0,
          packWzNiepowiazane: 0,
          pieceDostepne: 0,
          packDostepne: 10, // po cover z parenta
        },
        bom: {
          role: "component",
          contributionSales: 2,
          contributionWz: 0,
          contributionCover: 10,
          parentTwIds: [4],
        },
      }),
    ];
    const out = coerceZdEstimateLinesBase(rows);
    expect(out[0]!.sprzedazOkres).toBe(1);
    expect(out[0]!.dostepne).toBe(0);
    expect(out[0]!.pair).toBeNull();
    expect(out[0]!.bom).toBeNull();
  });
});
