import { describe, expect, it } from "vitest";
import { resolveZdRunDniZapasu, ZD_SUPPLIER_ORDER_POLICY_CLASSIC, type ZdSupplierOrderPolicy } from "./zd-demand-policy";
import { buildManualZdEstimateResult, mapZdEstimateLineToManual } from "./zd-estimate-manual";
import { computeSalesTrackedCel } from "./zd-estimate-sales-track";
import { zdEstimateRefreshDays } from "./zd-estimate-live-refresh";
import type { SubiektZdEstimateLine } from "@/lib/subiekt/types";

// Ręcznie podniesiony zapas (np. większe zamówienie na koniec roku): cel na więcej dni, korekty jak przy zwykłym.
const strategy: ZdSupplierOrderPolicy = { strategy: "max30_90", targetDays: 21, cycleDays: 2 };

describe("resolveZdRunDniZapasu", () => {
  it("bez podniesienia: jak dotąd (strategia liczy swoje dni, classic pole)", () => {
    expect(resolveZdRunDniZapasu({ policy: strategy, dniZapasu: 30 })).toEqual({ dniZapasu: 21, signalDniZapasu: null, raised: false });
    expect(resolveZdRunDniZapasu({ policy: strategy, dniZapasu: 30, normalDniZapasu: 30 })).toEqual({
      dniZapasu: 21,
      signalDniZapasu: null,
      raised: false,
    });
    expect(resolveZdRunDniZapasu({ policy: ZD_SUPPLIER_ORDER_POLICY_CLASSIC, dniZapasu: 45 })).toEqual({
      dniZapasu: 45,
      signalDniZapasu: null,
      raised: false,
    });
  });

  it("pole ponad kartę podnosi cel strategii; korekty na dniach strategii", () => {
    expect(resolveZdRunDniZapasu({ policy: strategy, dniZapasu: 90, normalDniZapasu: 30 })).toEqual({
      dniZapasu: 90,
      signalDniZapasu: 21,
      raised: true,
    });
  });

  it("classic: pole ponad kartę, korekty na dniach karty", () => {
    expect(resolveZdRunDniZapasu({ policy: ZD_SUPPLIER_ORDER_POLICY_CLASSIC, dniZapasu: 90, normalDniZapasu: 30 })).toEqual({
      dniZapasu: 90,
      signalDniZapasu: 30,
      raised: true,
    });
  });

  it("strategia z długą dostawą: podniesienie poniżej cyklu + dostawy nic nie zmienia", () => {
    const timing = { leadDays: 30, nextOrderDays: 5 };
    // 2 + 30 + 8 = 40
    expect(resolveZdRunDniZapasu({ policy: strategy, dniZapasu: 35, normalDniZapasu: 30, timing }).dniZapasu).toBe(40);
    expect(resolveZdRunDniZapasu({ policy: strategy, dniZapasu: 35, normalDniZapasu: 30, timing }).signalDniZapasu).toBeNull();
    expect(resolveZdRunDniZapasu({ policy: strategy, dniZapasu: 90, normalDniZapasu: 30, timing })).toEqual({
      dniZapasu: 90,
      signalDniZapasu: 40,
      raised: true,
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
    });
    expect(zdEstimateRefreshDays({ dniZapasu: 30, dniOkresu: 30 }, "30").signalDniZapasu).toBeNull();
  });
});
