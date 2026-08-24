import { describe, expect, it } from "vitest";
import {
  buildManualZdEstimateResult,
  computeManualOrderQty,
  filterOrderableManualLines,
  mapZdEstimateLineToManual,
  mapZdEstimateLinesSolo,
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

  it("ujemne dostępne (dług rezerwacji) zwiększa qty", () => {
    expect(
      computeManualOrderQty({ celZapasu: 4, dostepne: -1, otwarteZd: 0 })
    ).toBe(5);
  });

  it("screenshot: stan12 rez40 cel83 → potrzeba 111 szt", () => {
    expect(
      computeManualOrderQty({ celZapasu: 83, dostepne: -28, otwarteZd: 0 })
    ).toBe(111);
  });

  it("screenshot pack 10: 111 szt → 12 op. (arrive 120)", () => {
    const pieces = computeManualOrderQty({
      celZapasu: 83,
      dostepne: -28,
      otwarteZd: 0,
    });
    expect(Math.ceil(pieces / 10)).toBe(12);
    expect(12 * 10).toBe(120);
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
    const m = mapZdEstimateLineToManual(base, { salesTrack: false });
    expect(m.doZamowieniaReczne).toBe(8);
    expect(m.doZamowieniaApi).toBe(469.516);
    expect(m.wkladZk).toBeGreaterThan(400);
    expect(m.celZapasuTracked).toBe(m.celZapasu);
    expect(m.salesTrackDelta).toBe(0);
  });

  it("podążanie za sprzedażą podbija cel i qty przy cienkim pokryciu", () => {
    const m = mapZdEstimateLineToManual(base, {
      dniZapasu: 30,
      salesTrack: true,
    });
    expect(m.doZamowieniaReczne).toBeGreaterThan(8);
    expect(m.salesTrackDelta).toBeGreaterThan(0);
    expect(m.celZapasuTracked).toBeGreaterThan(m.celZapasu);
    expect(m.salesTrackReasons.length).toBeGreaterThan(0);
  });

  it("niski sell-through obniża qty względem samego celu Subiekta", () => {
    const line = {
      ...base,
      celZapasu: 100,
      dostepne: 55,
      sprzedazOkres: 8,
      sprzedazDziennie: 1,
      otwarteZd: 0,
      doZamowienia: 45,
      otwarteZkBezRez: 0,
    };
    const off = mapZdEstimateLineToManual(line, {
      dniZapasu: 30,
      salesTrack: true,
      salesTrackCuts: false,
    });
    const on = mapZdEstimateLineToManual(line, {
      dniZapasu: 30,
      salesTrack: true,
      salesTrackCuts: true,
    });
    expect(on.salesTrackDelta).toBeLessThan(0);
    expect(on.doZamowieniaReczne).toBeLessThan(off.doZamowieniaReczne);
  });

  it("martwy SKU z zapasem ≥ cel → qty 0", () => {
    const m = mapZdEstimateLineToManual(
      {
        ...base,
        celZapasu: 20,
        dostepne: 25,
        sprzedazOkres: 0,
    wzNiepowiazaneOkres: 0,
        sprzedazDziennie: 0,
        otwarteZd: 0,
        doZamowienia: 0,
        otwarteZkBezRez: 0,
      },
      { salesTrack: true }
    );
    expect(m.celZapasuTracked).toBe(0);
    expect(m.doZamowieniaReczne).toBe(0);
    expect(m.salesTrackReasons).toContain("dead_stock");
  });

  it("historia wolnego ZD dodatkowo obniża cel", () => {
    const linkedAt = new Date(
      Date.now() - 20 * 24 * 60 * 60 * 1000
    ).toISOString();
    const line = {
      ...base,
      celZapasu: 100,
      dostepne: 40,
      sprzedazOkres: 8,
      sprzedazDziennie: 1,
      otwarteZd: 0,
      doZamowienia: 60,
      otwarteZkBezRez: 0,
    };
    const without = mapZdEstimateLineToManual(line, {
      dniZapasu: 30,
      salesTrackCuts: false,
    });
    const withHist = mapZdEstimateLineToManual(line, {
      dniZapasu: 30,
      salesTrackCuts: true,
      history: { lastOrderedQty: 50, linkedAt },
    });
    expect(withHist.salesTrackReasons).toContain("history_slow");
    expect(withHist.celZapasuTracked).toBeLessThan(without.celZapasuTracked);
  });

  it("opakowanie: otwarte ZD (paczki) → sztuki w qty i cover", () => {
    const line = {
      ...base,
      celZapasu: 40,
      dostepne: 10,
      otwarteZd: 2, // 2 op. × 10 = 20 szt
      sprzedazOkres: 0,
    wzNiepowiazaneOkres: 0,
      sprzedazDziennie: 0,
      doZamowienia: 100,
      otwarteZkBezRez: 0,
    };
    const raw = mapZdEstimateLineToManual(line, {
      salesTrack: false,
    });
    const packed = mapZdEstimateLineToManual(line, {
      salesTrack: false,
      unitsPerPackage: 10,
    });
    // bez pack: 40−10−2=28; z pack: 40−10−20=10
    expect(raw.doZamowieniaReczne).toBe(28);
    expect(packed.doZamowieniaReczne).toBe(10);
    expect(packed.otwarteZd).toBe(2); // surowe jednostki API
  });

  it("live remat Manual: doZamowieniaApi bez doZamowienia", () => {
    const mapped = mapZdEstimateLineToManual(base, { salesTrack: false });
    expect(mapped.doZamowieniaApi).toBe(469.516);
    const again = mapZdEstimateLineToManual(mapped, { salesTrack: false });
    expect(again.doZamowieniaApi).toBe(469.516);
    expect(again.wkladZk).toBe(mapped.wkladZk);
  });

  it("mapZdEstimateLinesSolo: opakowanie z mapy, pary bez track", () => {
    const solo = {
      ...base,
      tw_Id: 1,
      celZapasu: 40,
      dostepne: 10,
      otwarteZd: 2,
      sprzedazOkres: 0,
    wzNiepowiazaneOkres: 0,
      sprzedazDziennie: 0,
      doZamowienia: 100,
    };
    const packSku = {
      ...base,
      tw_Id: 100,
      celZapasu: 40,
      dostepne: 0,
      otwarteZd: 0,
      sprzedazOkres: 80,
      sprzedazDziennie: 2,
      doZamowienia: 40,
    };
    const out = mapZdEstimateLinesSolo([solo, packSku], {
      dniZapasu: 30,
      salesTrack: true,
      packagingByTwId: new Map([
        [1, { unitsPerPackage: 10, documentUnitMode: "packages" }],
      ]),
      productPairs: [{ packTwId: 100, pieceTwId: 200, unitsPerPack: 10 }],
    });
    expect(out.find((l) => l.tw_Id === 1)?.doZamowieniaReczne).toBe(10);
    const packLine = out.find((l) => l.tw_Id === 100)!;
    expect(packLine.celZapasuTracked).toBe(packLine.celZapasu);
    expect(packLine.salesTrackDelta).toBe(0);
  });

  it("opakowanie Mode B: otwarteZd bez × N", () => {
    const line = {
      ...base,
      celZapasu: 40,
      dostepne: 10,
      otwarteZd: 10, // Mode B: 10 szt na dokumencie
      sprzedazOkres: 0,
    wzNiepowiazaneOkres: 0,
      sprzedazDziennie: 0,
      doZamowienia: 100,
      otwarteZkBezRez: 0,
    };
    const packedA = mapZdEstimateLineToManual(line, {
      salesTrack: false,
      unitsPerPackage: 5,
      documentUnitMode: "packages",
    });
    // A: 10 op. × 5 = 50 szt cover → doZam = max(0, 40-10-50)=0
    expect(packedA.doZamowieniaReczne).toBe(0);
    const packedB = mapZdEstimateLineToManual(line, {
      salesTrack: false,
      unitsPerPackage: 5,
      documentUnitMode: "pieces_multiple",
    });
    // B: 10 szt cover → 40-10-10=20
    expect(packedB.doZamowieniaReczne).toBe(20);
  });

  it("opakowanie × historia: snapshot qty w sztukach vs paczki w otwarteZd", () => {
    const linkedAt = new Date(
      Date.now() - 20 * 24 * 60 * 60 * 1000
    ).toISOString();
    const line = {
      ...base,
      celZapasu: 100,
      dostepne: 50,
      otwarteZd: 5, // 5 op. × 10 = 50 szt cover
      sprzedazOkres: 5,
      sprzedazDziennie: 1,
      doZamowienia: 50,
      otwarteZkBezRez: 0,
    };
    // cover bez pack: 55 dni; z pack: 100 szt / 1 = 100 dni — obie ≥ dniZapasu
    const withHist = mapZdEstimateLineToManual(line, {
      dniZapasu: 30,
      unitsPerPackage: 10,
      history: { lastOrderedQty: 100, linkedAt }, // sztuki z snapshotu
    });
    expect(withHist.salesTrackReasons).toContain("history_slow");
  });

  it("sales_spike: sprzedaż w oknie ≫ ostatnie ZD — obniża doZamowienia", () => {
    const linkedAt = new Date(
      Date.now() - 20 * 24 * 60 * 60 * 1000
    ).toISOString();
    const line = {
      ...base,
      celZapasu: 300,
      dostepne: 0,
      otwarteZd: 0,
      sprzedazOkres: 300,
      sprzedazDziennie: 10,
      doZamowienia: 300,
      otwarteZkBezRez: 0,
    };
    const without = mapZdEstimateLineToManual(line, {
      dniZapasu: 30,
      dniOkresu: 30,
      salesTrack: true,
      salesTrackCuts: true,
    });
    const withHist = mapZdEstimateLineToManual(line, {
      dniZapasu: 30,
      dniOkresu: 30,
      salesTrack: true,
      salesTrackCuts: true,
      history: { lastOrderedQty: 100, linkedAt },
    });
    expect(withHist.salesTrackReasons).toContain("sales_spike");
    expect(withHist.celZapasuTracked).toBeLessThan(without.celZapasuTracked);
    expect(withHist.doZamowieniaReczne).toBeLessThan(without.doZamowieniaReczne);
  });

  it("liczy dostepne ze stanu gdy brak pola", () => {
    const m = mapZdEstimateLineToManual(
      {
        ...base,
        dostepne: undefined,
        tw_Stan: 40,
        tw_StanRez: 5,
        celZapasu: 50,
        otwarteZd: 0,
        doZamowienia: 100,
        otwarteZkBezRez: 65,
        sprzedazOkres: 0,
    wzNiepowiazaneOkres: 0,
        sprzedazDziennie: 0,
      },
      { salesTrack: false }
    );
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
    const m = mapZdEstimateLineToManual(
      {
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
        sprzedazOkres: 0,
    wzNiepowiazaneOkres: 0,
        sprzedazDziennie: 0,
      },
      { salesTrack: false }
    );
    const tsv = manualLinesToTsv([m]);
    expect(tsv.split("\n")[0]).toContain("do_zd");
    expect(tsv.split("\n")[0]).toContain("cel_sledzony");
    expect(tsv.split("\n")[0]).toContain("delta_sledzenia");
    expect(tsv).toContain("\t7\t");
  });

  it("Mode B: do_zd = sztuki dobite, nie liczba paczek", () => {
    const m = mapZdEstimateLineToManual(
      {
        tw_Id: 1,
        tw_Symbol: "X",
        tw_Nazwa: "Towar",
        celZapasu: 8,
        dostepne: 0,
        otwarteZd: 0,
        doZamowienia: 8,
        otwarteZkBezRez: 0,
        tw_Stan: 0,
        tw_StanRez: 0,
        sprzedazOkres: 0,
    wzNiepowiazaneOkres: 0,
        sprzedazDziennie: 0,
      },
      { salesTrack: false }
    );
    expect(m.doZamowieniaReczne).toBe(8);
    const tsvA = manualLinesToTsv(
      [m],
      new Map([[1, { unitsPerPackage: 5, documentUnitMode: "packages" }]])
    );
    expect(tsvA.split("\n")[1]?.split("\t")[2]).toBe("2");
    const tsvB = manualLinesToTsv(
      [m],
      new Map([
        [1, { unitsPerPackage: 5, documentUnitMode: "pieces_multiple" }],
      ])
    );
    expect(tsvB.split("\n")[1]?.split("\t")[2]).toBe("10");
    expect(tsvB.split("\n")[1]?.split("\t")[4]).toBe("10");
  });
});
