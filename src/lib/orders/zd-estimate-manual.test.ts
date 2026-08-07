import { describe, expect, it } from "vitest";
import {
  buildManualZdEstimateResult,
  computeManualOrderQty,
  filterOrderableManualLines,
  mapZdEstimateLineToManual,
  manualLinesToTsv,
  salesWindowFromDniZapasu,
  stockPeriodToDniZapasu,
  summarizeManualOrderQty,
} from "./zd-estimate-manual";
import type { SubiektZdEstimateLine } from "@/lib/subiekt/types";

describe("stockPeriodToDniZapasu", () => {
  it("miesiąc → 30 dni", () => {
    expect(stockPeriodToDniZapasu("1 miesiąc", null)).toBe(30);
    expect(stockPeriodToDniZapasu("2 miesiące", null)).toBe(60);
  });

  it("tygodnie → ×7", () => {
    expect(stockPeriodToDniZapasu("4", null)).toBe(28);
    expect(stockPeriodToDniZapasu(null, 3)).toBe(21);
  });

  it("w razie potrzeby → null", () => {
    expect(stockPeriodToDniZapasu("W razie potrzeby", null)).toBeNull();
  });

  it("puste → null", () => {
    expect(stockPeriodToDniZapasu(null, null)).toBeNull();
    expect(stockPeriodToDniZapasu("", null)).toBeNull();
  });
});

describe("computeManualOrderQty", () => {
  it("cel − stan − ZD, ceil w górę", () => {
    expect(
      computeManualOrderQty({ celZapasu: 74.5, dostepne: 67, otwarteZd: 0 })
    ).toBe(8);
  });

  it("nie zamawia gdy stan pokrywa cel", () => {
    expect(
      computeManualOrderQty({ celZapasu: 13.5, dostepne: 22, otwarteZd: 0 })
    ).toBe(0);
  });

  it("zmniejsza o otwarte ZD", () => {
    expect(
      computeManualOrderQty({ celZapasu: 50, dostepne: 10, otwarteZd: 15 })
    ).toBe(25);
  });

  it("nie schodzi poniżej zera gdy ZD > potrzeba", () => {
    expect(
      computeManualOrderQty({ celZapasu: 20, dostepne: 5, otwarteZd: 40 })
    ).toBe(0);
  });

  it("ujemne dostępne nie zawyża qty (clamp do 0)", () => {
    expect(
      computeManualOrderQty({ celZapasu: 4, dostepne: -1, otwarteZd: 0 })
    ).toBe(4);
  });

  it("nie uwzględnia ZK (osobne pole w mapowaniu)", () => {
    // Świadomie: funkcja nie bierze ZK — regresja gdy ktoś doda parametr.
    expect(
      computeManualOrderQty({ celZapasu: 10, dostepne: 10, otwarteZd: 0 })
    ).toBe(0);
  });
});

describe("mapZdEstimateLineToManual", () => {
  const base: SubiektZdEstimateLine = {
    tw_Id: 12010,
    tw_Symbol: "667693",
    tw_Nazwa: "Ips Ivocolor Glaze Paste FLUO 9g",
    tw_IdGrupa: 28,
    grt_Nazwa: "Ivoclar Technical",
    tw_Stan: 67,
    tw_StanRez: 0,
    dostepne: 67,
    sprzedazOkres: 77,
    sprzedazDziennie: 2.48,
    celZapasu: 74.516,
    otwarteZkBezRez: 462,
    otwarteZkZarezerwowane: 0,
    otwarteZd: 0,
    doZamowienia: 469.516,
  };

  it("liczy qty ręczne bez ZK — API zostaje w osobnym polu", () => {
    const m = mapZdEstimateLineToManual(base);
    expect(m.doZamowieniaReczne).toBe(8);
    expect(m.doZamowieniaApi).toBe(469.516);
    expect(m.wkladZk).toBeGreaterThan(400);
  });

  it("liczy dostepne ze stanu gdy brak pola", () => {
    const m = mapZdEstimateLineToManual({
      ...base,
      dostepne: undefined,
      tw_Stan: 40,
      tw_StanRez: 5,
      celZapasu: 50,
      otwarteZd: 0,
      doZamowienia: 100,
      otwarteZkBezRez: 65,
    });
    expect(m.dostepne).toBe(35);
    expect(m.doZamowieniaReczne).toBe(15);
  });
});

describe("buildManualZdEstimateResult", () => {
  it("domyślnie zwraca pełną listę z Subiekta; onlyManualBraki filtruje", () => {
    const lines: SubiektZdEstimateLine[] = [
      {
        tw_Id: 1,
        tw_Symbol: "B",
        tw_Nazwa: "niski",
        celZapasu: 12,
        dostepne: 10,
        otwarteZd: 0,
        doZamowienia: 50,
        otwarteZkBezRez: 48,
      },
      {
        tw_Id: 2,
        tw_Symbol: "A",
        tw_Nazwa: "wysoki",
        celZapasu: 40,
        dostepne: 5,
        otwarteZd: 0,
        doZamowienia: 100,
        otwarteZkBezRez: 65,
      },
      {
        tw_Id: 3,
        tw_Symbol: "C",
        tw_Nazwa: "tylko ZK",
        celZapasu: 5,
        dostepne: 10,
        otwarteZd: 0,
        doZamowienia: 20,
        otwarteZkBezRez: 25,
      },
    ];
    const full = buildManualZdEstimateResult({}, lines);
    expect(full.totalFromSubiekt).toBe(3);
    expect(full.pozycje).toHaveLength(3);
    expect(full.doZamowieniaCount).toBe(2);
    expect(full.doZamowieniaSuma).toBe(37);
    expect(full.pozycje[0]?.tw_Symbol).toBe("A");

    const only = buildManualZdEstimateResult({}, lines, {
      onlyManualBraki: true,
    });
    expect(only.pozycje).toHaveLength(2);
    expect(only.totalFromSubiekt).toBe(3);
  });
});

describe("summarizeManualOrderQty", () => {
  it("pomija wykluczone tw_Id przy sumie do zamówienia", () => {
    const lines = [
      mapZdEstimateLineToManual({
        tw_Id: 1,
        tw_Symbol: "A",
        tw_Nazwa: "a",
        celZapasu: 20,
        dostepne: 5,
        otwarteZd: 0,
        doZamowienia: 15,
      }),
      mapZdEstimateLineToManual({
        tw_Id: 2,
        tw_Symbol: "B",
        tw_Nazwa: "b",
        celZapasu: 10,
        dostepne: 1,
        otwarteZd: 0,
        doZamowienia: 9,
      }),
      mapZdEstimateLineToManual({
        tw_Id: 3,
        tw_Symbol: "C",
        tw_Nazwa: "c",
        celZapasu: 5,
        dostepne: 10,
        otwarteZd: 0,
        doZamowienia: 0,
      }),
    ];
    expect(summarizeManualOrderQty(lines)).toEqual({
      doZamowieniaCount: 2,
      doZamowieniaSuma: 24,
    });
    expect(summarizeManualOrderQty(lines, new Set([1]))).toEqual({
      doZamowieniaCount: 1,
      doZamowieniaSuma: 9,
    });
    expect(summarizeManualOrderQty(lines, [1, 2])).toEqual({
      doZamowieniaCount: 0,
      doZamowieniaSuma: 0,
    });
  });
});

describe("filterOrderableManualLines", () => {
  it("zwraca tylko qty > 0 poza wykluczeniami (pod TSV)", () => {
    const lines = [
      mapZdEstimateLineToManual({
        tw_Id: 1,
        tw_Symbol: "A",
        tw_Nazwa: "a",
        celZapasu: 20,
        dostepne: 5,
        otwarteZd: 0,
        doZamowienia: 15,
      }),
      mapZdEstimateLineToManual({
        tw_Id: 2,
        tw_Symbol: "B",
        tw_Nazwa: "b",
        celZapasu: 10,
        dostepne: 1,
        otwarteZd: 0,
        doZamowienia: 9,
      }),
      mapZdEstimateLineToManual({
        tw_Id: 3,
        tw_Symbol: "C",
        tw_Nazwa: "c",
        celZapasu: 5,
        dostepne: 10,
        otwarteZd: 0,
        doZamowienia: 0,
      }),
    ];
    expect(filterOrderableManualLines(lines, [1]).map((l) => l.tw_Id)).toEqual([
      2,
    ]);
    expect(filterOrderableManualLines(lines).map((l) => l.tw_Id)).toEqual([
      1, 2,
    ]);
  });
});

describe("salesWindowFromDniZapasu", () => {
  it("okno 30 dni kończące się dataDo jest domknięte", () => {
    expect(salesWindowFromDniZapasu(30, "2026-04-24")).toEqual({
      dataOd: "2026-03-26",
      dataDo: "2026-04-24",
    });
  });

  it("1 dzień → dataOd = dataDo", () => {
    expect(salesWindowFromDniZapasu(1, "2026-08-06")).toEqual({
      dataOd: "2026-08-06",
      dataDo: "2026-08-06",
    });
  });
});

describe("manualLinesToTsv", () => {
  it("eksportuje nagłówek i qty ręczne", () => {
    const m = mapZdEstimateLineToManual({
      tw_Id: 1,
      tw_Symbol: "X",
      tw_Nazwa: "Towar",
      celZapasu: 10.2,
      dostepne: 3,
      otwarteZd: 1,
      doZamowienia: 20,
      otwarteZkBezRez: 13,
      tw_Stan: 3,
      tw_StanRez: 0,
      sprzedazOkres: 10,
    });
    const tsv = manualLinesToTsv([m]);
    expect(tsv.split("\n")[0]).toContain("do_zd");
    expect(tsv).toContain("\t7\t");
  });
});
