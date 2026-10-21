import { describe, expect, it } from "vitest";
import { computeSalesTrackedCel } from "@/lib/orders/zd-estimate-sales-track";
import { buildManualZdEstimateResult, zdEstimateWindowDays } from "@/lib/orders/zd-estimate-manual";

describe("cel zapasu - niezależność od długości okna sprzedaży", () => {
  const at = (sprzedazOkres: number, dniOkresu: number, celZapasu: number, dostepne: number) =>
    computeSalesTrackedCel({
      celZapasu,
      sprzedazOkres,
      sprzedazDziennie: sprzedazOkres / dniOkresu,
      dostepne,
      dniZapasu: 30,
      dniOkresu,
    }).celTracked;

  it("to samo tempo 1 szt./d: okno 30 i 90 dni dają ten sam cel", () => {
    expect(at(90, 90, 30, 27)).toBeCloseTo(at(30, 30, 30, 27), 6);
    expect(at(180, 180, 30, 27)).toBeCloseTo(at(30, 30, 30, 27), 6);
  });

  it("krótkie okno: stan poniżej celu nie dostaje cięcia „niski sell-through”", () => {
    const r = computeSalesTrackedCel({
      celZapasu: 60,
      sprzedazOkres: 28,
      sprzedazDziennie: 2,
      dostepne: 52,
      dniZapasu: 30,
      dniOkresu: 14,
    });
    expect(r.reasons).not.toContain("low_sell_through");
  });
});

describe("okno sprzedaży bez dniOkresu z API", () => {
  it("liczone z dat, włącznie", () => {
    expect(zdEstimateWindowDays({ dataOd: "2026-09-21", dataDo: "2026-10-20" })).toBe(30);
    expect(zdEstimateWindowDays({ dniOkresu: 45, dataOd: "2026-09-21", dataDo: "2026-10-20" })).toBe(45);
    expect(zdEstimateWindowDays({})).toBeNull();
  });

  it("para paczka↔sztuka liczy tempo z okna, nie z dni zapasu", () => {
    const params = { dniZapasu: 60, dataOd: "2026-09-21", dataDo: "2026-10-20", zapasMin: 0 };
    const res = buildManualZdEstimateResult(
      params,
      [
        { tw_Id: 1, tw_Symbol: "KARTON", sprzedazOkres: 0, dostepne: 0, celZapasu: 0 },
        { tw_Id: 2, tw_Symbol: "SZT", sprzedazOkres: 30, dostepne: 0, celZapasu: 0 },
      ],
      { salesTrack: false, productPairs: [{ packTwId: 1, pieceTwId: 2, unitsPerPack: 10 }] }
    );
    expect(res.pozycje.find((p) => p.tw_Id === 1)!.celZapasuTracked).toBe(60);
  });
});
