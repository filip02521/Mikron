import { describe, expect, it } from "vitest";
import { resolveZdRunDniZapasu, ZD_SUPPLIER_ORDER_POLICY_CLASSIC, type ZdSupplierOrderPolicy } from "./zd-demand-policy";
import { buildManualZdEstimateResult, mapZdEstimateLineToManual } from "./zd-estimate-manual";
import { computeSalesTrackedCel } from "./zd-estimate-sales-track";
import { zdEstimateRefreshDays } from "./zd-estimate-live-refresh";
import { applyZdEstimatePairs } from "./zd-estimate-pairs";
import type { SubiektZdEstimateLine } from "@/lib/subiekt/types";

// Ręcznie podniesiony zapas (np. większe zamówienie na koniec roku): cel na więcej dni, korekty jak przy zwykłym.
const strategy: ZdSupplierOrderPolicy = { strategy: "max30_90", targetDays: 21, cycleDays: 2 };

describe("resolveZdRunDniZapasu", () => {
  it("bez karty / pola: jak dotąd (strategia liczy swoje dni, classic dni biegu)", () => {
    expect(resolveZdRunDniZapasu({ policy: strategy, dniZapasu: 30 })).toEqual({ dniZapasu: 21, signalDniZapasu: null });
    expect(resolveZdRunDniZapasu({ policy: ZD_SUPPLIER_ORDER_POLICY_CLASSIC, dniZapasu: 45 })).toEqual({
      dniZapasu: 45,
      signalDniZapasu: null,
    });
  });

  it("pole równe karcie (albo mniejsze): bez zmian", () => {
    expect(resolveZdRunDniZapasu({ policy: strategy, dniZapasu: 30, normalDniZapasu: 30, manualDniZapasu: 30 })).toEqual({
      dniZapasu: 21,
      signalDniZapasu: null,
    });
    expect(
      resolveZdRunDniZapasu({ policy: ZD_SUPPLIER_ORDER_POLICY_CLASSIC, dniZapasu: 14, normalDniZapasu: 30, manualDniZapasu: 14 })
    ).toEqual({ dniZapasu: 14, signalDniZapasu: null });
  });

  it("strategia: pole ponad kartę podnosi cel; korekty na dniach strategii", () => {
    expect(resolveZdRunDniZapasu({ policy: strategy, dniZapasu: 90, normalDniZapasu: 30, manualDniZapasu: 90 })).toEqual({
      dniZapasu: 90,
      signalDniZapasu: 21,
    });
    // z horyzontem dłuższym niż pole: dni biegu (horyzont)
    expect(resolveZdRunDniZapasu({ policy: strategy, dniZapasu: 100, normalDniZapasu: 30, manualDniZapasu: 90 }).dniZapasu).toBe(100);
  });

  it("strategia: sam horyzont (pole = karta) nie zmienia dni strategii", () => {
    expect(resolveZdRunDniZapasu({ policy: strategy, dniZapasu: 45, normalDniZapasu: 30, manualDniZapasu: 30 })).toEqual({
      dniZapasu: 21,
      signalDniZapasu: null,
    });
  });

  it("classic: pole albo horyzont ponad kartę — korekty na dniach karty", () => {
    expect(
      resolveZdRunDniZapasu({ policy: ZD_SUPPLIER_ORDER_POLICY_CLASSIC, dniZapasu: 90, normalDniZapasu: 30, manualDniZapasu: 90 })
    ).toEqual({ dniZapasu: 90, signalDniZapasu: 30 });
    expect(
      resolveZdRunDniZapasu({ policy: ZD_SUPPLIER_ORDER_POLICY_CLASSIC, dniZapasu: 45, normalDniZapasu: 30, manualDniZapasu: 30 })
    ).toEqual({ dniZapasu: 45, signalDniZapasu: 30 });
  });

  it("strategia z długą dostawą: podniesienie poniżej cyklu + dostawy nic nie zmienia", () => {
    const timing = { leadDays: 30, nextOrderDays: 5 };
    // 2 + 30 + 8 = 40
    expect(resolveZdRunDniZapasu({ policy: strategy, dniZapasu: 35, normalDniZapasu: 30, manualDniZapasu: 35, timing })).toEqual({
      dniZapasu: 40,
      signalDniZapasu: null,
    });
    expect(resolveZdRunDniZapasu({ policy: strategy, dniZapasu: 90, normalDniZapasu: 30, manualDniZapasu: 90, timing })).toEqual({
      dniZapasu: 90,
      signalDniZapasu: 40,
    });
  });
});

const trackInput = (dni: number, cover: number, signal?: number | null) => ({
  celZapasu: 2 * dni,
  sprzedazOkres: 60,
  sprzedazDziennie: 2,
  dostepne: cover,
  otwarteZd: 0,
  dniZapasu: dni,
  dniOkresu: 30,
  signalDniZapasu: signal,
});

describe("computeSalesTrackedCel — sygnały na dniach zwykłego zamówienia", () => {
  it("signalDniZapasu równe dniom zapasu (albo brak) = wynik jak dotąd", () => {
    for (const cover of [0, 10, 40, 80, 200]) {
      const base = computeSalesTrackedCel(trackInput(30, cover));
      expect(computeSalesTrackedCel(trackInput(30, cover, 30))).toEqual(base);
      expect(computeSalesTrackedCel(trackInput(30, cover, 45))).toEqual(base);
    }
  });

  it("90 dni przy karcie 30: korekta jak przy 30 dniach, dodatkowe dni = samo tempo", () => {
    for (const cover of [0, 10, 20]) {
      const normal = computeSalesTrackedCel(trackInput(30, cover));
      const raised = computeSalesTrackedCel(trackInput(90, cover, 30));
      expect(raised.reasons).toEqual(normal.reasons);
      expect(raised.celTracked - normal.celTracked).toBeCloseTo(2 * 60, 6);
    }
  });

  it("bez sygnałów karty 90 dni wyglądało cienko i podbijało ponad tempo × dni", () => {
    const old = computeSalesTrackedCel(trackInput(90, 20));
    const normal = computeSalesTrackedCel(trackInput(30, 20));
    expect(old.celTracked - normal.celTracked).toBeGreaterThan(2 * 60 + 1);
  });
});

describe("skok vs ostatnie ZD przy podniesionym zapasie", () => {
  const linkedAt = new Date(Date.now() - 10 * 86_400_000).toISOString();
  // 2/d w oknie 30 d, stan 100 (50 dni), ostatnie ZD 50 szt — zwykłe zamówienie, bez skoku.
  const line = (dni: number): SubiektZdEstimateLine =>
    ({
      tw_Id: 1,
      tw_Symbol: "A",
      tw_Nazwa: "A",
      tw_Stan: 100,
      tw_StanRez: 0,
      dostepne: 100,
      otwarteZd: 0,
      sprzedazOkres: 60,
      sprzedazDziennie: 2,
      celZapasu: 2 * dni,
    }) as SubiektZdEstimateLine;
  const opts = (dni: number, signal?: number) => ({
    dniZapasu: dni,
    dniOkresu: 30,
    signalDniZapasu: signal,
    history: { lastOrderedQty: 50, linkedAt },
  });

  it("zwykłe zamówienie: bez cięcia", () => {
    expect(mapZdEstimateLineToManual(line(30), opts(30)).salesTrackReasons).not.toContain("sales_spike");
  });

  it("90 dni bez dni karty: ostatnie ZD brane jak na 90 dni → fałszywy skok", () => {
    expect(mapZdEstimateLineToManual(line(90), opts(90)).salesTrackReasons).toContain("sales_spike");
  });

  it("90 dni z dniami karty: oczekiwana sprzedaż z ZD na 30 dni → bez cięcia, cel = tempo × 90", () => {
    const m = mapZdEstimateLineToManual(line(90), opts(90, 30));
    expect(m.salesTrackReasons).not.toContain("sales_spike");
    // Stan 50 dni przy celu 90: żadnego cięcia „grube pokrycie” (to nie nadmiar przy tym celu).
    expect(m.salesTrackReasons).toEqual([]);
    expect(m.doZamowieniaReczne).toBe(180 - 100);
  });
});

describe("dni karty w parametrach wyniku (przeliczenia na kliencie)", () => {
  const lines = [
    {
      tw_Id: 7,
      tw_Symbol: "B",
      tw_Nazwa: "B",
      tw_Stan: 20,
      tw_StanRez: 0,
      dostepne: 20,
      otwarteZd: 0,
      sprzedazOkres: 60,
      sprzedazDziennie: 2,
      celZapasu: 180,
    },
  ] as SubiektZdEstimateLine[];

  it("buildManualZdEstimateResult czyta dniZapasuSygnaly z parametrów", () => {
    const withSignal = buildManualZdEstimateResult({ dniZapasu: 90, dniOkresu: 30, dniZapasuSygnaly: 30 }, lines);
    const direct = mapZdEstimateLineToManual(lines[0]!, { dniZapasu: 90, dniOkresu: 30, signalDniZapasu: 30, zapasMin: 0 });
    expect(withSignal.pozycje[0]!.celZapasuTracked).toBeCloseTo(direct.celZapasuTracked, 6);
    const without = buildManualZdEstimateResult({ dniZapasu: 90, dniOkresu: 30 }, lines);
    expect(without.pozycje[0]!.celZapasuTracked).not.toBeCloseTo(direct.celZapasuTracked, 3);
  });

  it("zdEstimateRefreshDays oddaje dni karty z paramInfo", () => {
    expect(zdEstimateRefreshDays({ dniZapasu: 90, dniOkresu: 30, dniZapasuSygnaly: 30 }, "90")).toEqual({
      dniZapasu: 90,
      dniOkresu: 30,
      signalDniZapasu: 30,
      historySpikeCut: undefined,
    });
    expect(zdEstimateRefreshDays({ dniZapasu: 30, dniOkresu: 30 }, "30").signalDniZapasu).toBeNull();
  });
});

describe("strategia: pojedyncze towary bez „skok vs ostatnie ZD” także w przeliczeniach na kliencie", () => {
  const linkedAt = new Date(Date.now() - 5 * 86_400_000).toISOString();
  // Sztuki 300 w 30 d (10/d), stan 300 szt (30 dni), ostatnie ZD 100 szt → sprzedaż 3× oczekiwana = skok.
  const pairLines = () => [
    { tw_Id: 10, tw_Symbol: "PACK", tw_Nazwa: "PACK", tw_IdGrupa: null, grt_Nazwa: "-", tw_Stan: 0, tw_StanRez: 0, dostepne: 0, sprzedazOkres: 0 },
    { tw_Id: 20, tw_Symbol: "PC", tw_Nazwa: "PC", tw_IdGrupa: null, grt_Nazwa: "-", tw_Stan: 300, tw_StanRez: 0, dostepne: 300, sprzedazOkres: 300 },
  ].map((l) => ({
    wzNiepowiazaneOkres: 0, sprzedazDziennie: 0, celZapasu: 0, celZapasuTracked: 0, salesTrackDelta: 0, salesTrackReasons: [],
    salesTrackConfidence: 0, salesTrackQtyReview: false, salesTrackHeldExtraQty: 0, salesTrackAllowedExtraQty: 0,
    otwarteZkBezRez: 0, otwarteZkZarezerwowane: 0, otwarteZd: 0, doZamowieniaApi: 0, doZamowieniaReczne: 0, wkladZk: 0, ...l,
  }));
  const pair = { packTwId: 10, pieceTwId: 20, unitsPerPack: 100 };
  const opts = { dniZapasu: 30, dniOkresu: 30, historyByTwId: new Map([[10, { lastOrderedQty: 100, linkedAt }]]) };

  it("para: skok vs ZD zostaje (profil pary nie tnie skoku — to jej jedyna ochrona)", () => {
    const out = applyZdEstimatePairs(pairLines(), [pair], opts).find((l) => l.tw_Id === 10)!;
    expect(out.salesTrackReasons).toContain("sales_spike");
  });

  it("bezSkokuZd w parametrach: wynik i dni do przeliczenia bez cięcia skoku", () => {
    const line = {
      tw_Id: 1, tw_Symbol: "A", tw_Nazwa: "A", tw_Stan: 300, tw_StanRez: 0, dostepne: 300, otwarteZd: 0,
      sprzedazOkres: 300, sprzedazDziennie: 10, celZapasu: 300,
    } as SubiektZdEstimateLine;
    const history = new Map([[1, { lastOrderedQty: 100, linkedAt }]]);
    const classic = buildManualZdEstimateResult({ dniZapasu: 30, dniOkresu: 30 }, [line], { historyByTwId: history });
    const strat = buildManualZdEstimateResult({ dniZapasu: 30, dniOkresu: 30, bezSkokuZd: true }, [line], { historyByTwId: history });
    expect(classic.pozycje[0]!.salesTrackReasons).toContain("sales_spike");
    expect(strat.pozycje[0]!.salesTrackReasons).not.toContain("sales_spike");
    expect(zdEstimateRefreshDays({ dniZapasu: 21, dniOkresu: 30, bezSkokuZd: true }, "30").historySpikeCut).toBe(false);
  });
});
