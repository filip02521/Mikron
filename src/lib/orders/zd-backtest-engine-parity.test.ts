/**
 * Decyzja backtestu = decyzja nocnego przebiegu dla tych samych danych. Ścieżka silnika złożona z jego funkcji
 * w kolejności `runZdOrderEngine` → `buildManualZdEstimateResult`: korekta dni braku → (strategia) prośby z profilu
 * i podłoga 90 d → podążanie za sprzedażą i historia ZD → minimum stanów → Do ZD.
 */
import { describe, expect, it } from "vitest";
import { zdBacktestDecideOrder } from "@/lib/orders/zd-backtest";
import { applyZdDemandFloorToLine, sales90FromProfile } from "@/lib/orders/zd-demand-policy";
import { policyForBoostPreset } from "@/lib/orders/zd-estimate-boost-presets";
import { mapZdEstimateLineToManual } from "@/lib/orders/zd-estimate-manual";
import { applyZdSalesProfileToLine, resolveZdSalesProfile } from "@/lib/orders/zd-sales-profile";
import { applyStockoutAdjustToLine, computeStockoutSalesFactor, stockoutMetaExcludingProsba } from "@/lib/stock-watch/stock-history";
import type { SubiektZdEstimateLine } from "@/lib/subiekt/types";

type Case = {
  name: string;
  strategy: "classic" | "max30_90";
  W: number;
  dni: number;
  seen: number;
  prosba: number;
  /** Trzy okna 30 d profilu do podłogi (od najstarszego): cała sprzedaż i sprzedaż pod prośby. */
  floor: [number, number, number];
  floorProsba: [number, number, number];
  stockout: { windowDays: number; recordedDays: number; outDays: number } | null;
  stock: number;
  reserved: number;
  onOrder: number;
  preset: "off" | "gentle" | "standard" | "aggressive";
  history: { qty: number; daysAgo: number } | null;
  minStock: number;
};

const base: Case = {
  name: "",
  strategy: "max30_90",
  W: 30,
  dni: 25,
  seen: 30,
  prosba: 0,
  floor: [30, 30, 30],
  floorProsba: [0, 0, 0],
  stockout: null,
  stock: 20,
  reserved: 0,
  onOrder: 0,
  preset: "gentle",
  history: null,
  minStock: 0,
};

const cases: Case[] = [
  { ...base, name: "zwykły wiersz" },
  { ...base, name: "cienkie pokrycie — podbicie", stock: 2 },
  { ...base, name: "grube pokrycie — cięcie", stock: 80 },
  { ...base, name: "podłoga 90 d wygrywa", seen: 6, floor: [57, 57, 6] },
  { ...base, name: "dni braku podnoszą tempo", stockout: { windowDays: 22, recordedDays: 22, outDays: 9 }, seen: 12 },
  { ...base, name: "dni braku i prośby (prośby bez mnożnika)", stockout: { windowDays: 22, recordedDays: 22, outDays: 9 }, seen: 12, prosba: 8, floor: [25, 25, 20], floorProsba: [0, 0, 8] },
  { ...base, name: "prośby odjęte z okna i ostatniego okna profilu", prosba: 10, floor: [30, 30, 40], floorProsba: [0, 0, 10] },
  { ...base, name: "prośba sprzed 45 dni nie podnosi podłogi", seen: 6, floor: [6, 66, 6], floorProsba: [0, 60, 0] },
  { ...base, name: "prośby w każdym oknie podłogi (okno nie mniej niż 0)", seen: 6, floor: [40, 20, 46], floorProsba: [10, 30, 40] },
  { ...base, name: "okno 60 dni", W: 60, dni: 40, seen: 50, floor: [27.5, 27.5, 25] },
  { ...base, name: "dług rezerwacji", stock: 5, reserved: 12 },
  { ...base, name: "w drodze", onOrder: 15, stock: 3 },
  { ...base, name: "minimum stanów", seen: 0, floor: [0, 0, 0], stock: 0, minStock: 6 },
  { ...base, name: "historia ZD — wolna sprzedaż od ostatniego zamówienia", history: { qty: 60, daysAgo: 20 }, stock: 40 },
  { ...base, name: "preset standard", preset: "standard", stock: 4 },
  { ...base, name: "preset agresywny", preset: "aggressive", stock: 4 },
  { ...base, name: "martwy towar", seen: 0.5, floor: [0, 0, 0.5], stock: 3 },
  { ...base, name: "Kreator (classic) — prośby i podłoga nie działają", strategy: "classic", prosba: 10, floor: [80, 80, 40], floorProsba: [0, 0, 10] },
  { ...base, name: "Kreator (classic) z dniami braku", strategy: "classic", stockout: { windowDays: 22, recordedDays: 20, outDays: 6 }, seen: 14, prosba: 4 },
];

/** Ścieżka nocnego przebiegu na jednym wierszu z API. */
function engine(c: Case, nowMs: number): number {
  const gross = c.seen + c.prosba;
  let line: SubiektZdEstimateLine = {
    tw_Id: 1,
    tw_Symbol: "X",
    tw_Nazwa: "Towar",
    tw_Stan: c.stock,
    tw_StanRez: c.reserved,
    sprzedazOkres: gross,
    sprzedazDziennie: gross / c.W,
    celZapasu: (gross / c.W) * c.dni,
    otwarteZd: c.onOrder,
    doZamowienia: 0,
  } as SubiektZdEstimateLine;
  if (c.stockout) {
    const meta = computeStockoutSalesFactor(c.stockout);
    const eff = meta ? stockoutMetaExcludingProsba(meta, Number(line.sprzedazOkres), c.prosba) : null;
    if (eff) line = applyStockoutAdjustToLine(line, eff, 0);
  }
  if (c.strategy === "max30_90") {
    // Profil: 12 okien po 30 d; ostatnie trzy dają sprzedaż z 90 d.
    const windows = [5, 5, 5, 5, 5, 5, 5, 5, 5, ...c.floor];
    let b = line;
    if (c.prosba > 0) {
      const pm = resolveZdSalesProfile({
        windows,
        sprzedazOkres: Number(line.sprzedazOkres) || 0,
        dniOkresu: c.W,
        prosbaPieces: c.prosba,
        smoothing: false,
        subtractProsba: true,
      });
      b = applyZdSalesProfileToLine(line, pm, 0);
    }
    line = applyZdDemandFloorToLine(b, {
      policy: { strategy: "max30_90", targetDays: c.dni, cycleDays: 7 },
      sales90: sales90FromProfile(windows, c.floorProsba),
      dniOkresu: c.W,
      dniZapasu: c.dni,
    });
  }
  const manual = mapZdEstimateLineToManual(line, {
    dniZapasu: c.dni,
    zapasMin: 0,
    dniOkresu: c.W,
    salesTrackPolicy: policyForBoostPreset(c.preset),
    history: c.history ? { lastOrderedQty: c.history.qty, linkedAt: new Date(nowMs - c.history.daysAgo * 86_400_000).toISOString() } : null,
    minStockSzt: c.minStock,
  });
  return manual.doZamowieniaReczne;
}

describe("decyzja backtestu = nocny przebieg (te same dane)", () => {
  const nowMs = Date.now();
  for (const c of cases) {
    it(c.name, () => {
      const bt = zdBacktestDecideOrder({
        strategy: c.strategy,
        windowDays: c.W,
        dniZapasu: c.dni,
        seenWindow: c.seen,
        prosbaWindow: c.prosba,
        floorGross: c.floor,
        floorProsba: c.floorProsba,
        stockout: c.stockout,
        dostepne: c.stock - c.reserved,
        onOrder: c.onOrder,
        trackPolicy: policyForBoostPreset(c.preset),
        lastOrder: c.history ? { qty: c.history.qty, linkedAt: new Date(nowMs - c.history.daysAgo * 86_400_000).toISOString() } : null,
        nowMs,
        minStock: c.minStock,
      });
      expect(bt.pieces).toBe(engine(c, nowMs));
    });
  }
  it("scenariusze naprawdę coś zmieniają (test nie jest pusty)", () => {
    const qty = new Set(cases.map((c) => engine(c, nowMs)));
    expect(qty.size).toBeGreaterThan(6);
  });
});
