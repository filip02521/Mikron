/**
 * Decyzja backtestu = decyzja nocnego przebiegu dla tych samych danych. Ścieżka silnika złożona z jego funkcji
 * w kolejności `runZdOrderEngine` → `buildManualZdEstimateResult`: korekta dni braku → (strategia) prośby z profilu
 * i podłoga 90 d → podążanie za sprzedażą i historia ZD → minimum stanów → Do ZD.
 */
import { describe, expect, it } from "vitest";
import { zdBacktestDecideOrder, zdBacktestPackPieces } from "@/lib/orders/zd-backtest";
import { applyZdDemandFloorToLine } from "@/lib/orders/zd-demand-policy";
import { policyForBoostPreset } from "@/lib/orders/zd-estimate-boost-presets";
import { mapZdEstimateLineToManual } from "@/lib/orders/zd-estimate-manual";
import { resolveOrderQtyForLine } from "@/lib/orders/zd-estimate-packaging";
import { applyZdSalesProfileToLine, resolveZdSalesProfile, sales90CappedFromProfile } from "@/lib/orders/zd-sales-profile";
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
  /** Dziewięć wcześniejszych okien profilu (domyślnie po 5). */
  profileHistory?: number[];
  stockout: { windowDays: number; recordedDays: number; outDays: number } | null;
  stock: number;
  reserved: number;
  onOrder: number;
  preset: "off" | "gentle" | "standard" | "aggressive";
  history: { qty: number; daysAgo: number } | null;
  minStock: number;
  /** Opakowanie z Kreatora: N sztuk w jednostce ZD, tryb dokumentu, wielokrotność paczek. */
  pack?: { units: number; mode: "packages" | "pieces_multiple"; mult: number | null };
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
  { ...base, name: "paczka 10 szt (1 szt na ZD = 10 szt), sprzedaż na sztuki", pack: { units: 10, mode: "packages", mult: null } },
  { ...base, name: "paczka 10 szt, w drodze 2 paczki (20 szt)", stock: 3, onOrder: 20, pack: { units: 10, mode: "packages", mult: null } },
  { ...base, name: "paczka 12 szt, mało potrzeba — zaokrąglenie w górę do pełnej paczki", seen: 3, floor: [3, 3, 3], stock: 1, pack: { units: 12, mode: "packages", mult: null } },
  { ...base, name: "paczka 10 szt, wielokrotność 3 paczek", pack: { units: 10, mode: "packages", mult: 3 } },
  { ...base, name: "ZD w sztukach, wielokrotność 6 szt", pack: { units: 6, mode: "pieces_multiple", mult: null } },
  { ...base, name: "paczka 10 szt i minimum stanów", seen: 0, floor: [0, 0, 0], stock: 0, minStock: 4, pack: { units: 10, mode: "packages", mult: null } },
  { ...base, name: "jednorazowy skok w oknie — tempo z typowego miesiąca", seen: 34, floor: [4, 5, 34], stock: 3, profileHistory: [4, 5, 3, 4, 6, 4, 5, 4, 3] },
  { ...base, name: "skok sprzed 45 dni nie podnosi podłogi", seen: 4, floor: [4, 34, 4], stock: 3, profileHistory: [4, 5, 3, 4, 6, 4, 5, 4, 3] },
  { ...base, name: "skok w paczkach 10 szt", seen: 34, floor: [4, 5, 34], stock: 3, profileHistory: [4, 5, 3, 4, 6, 4, 5, 4, 3], pack: { units: 10, mode: "packages", mult: null } },
  { ...base, name: "wzrost (dwa wysokie okna) — bez cięcia", seen: 30, floor: [4, 30, 30], stock: 3, profileHistory: [4, 5, 3, 4, 6, 4, 5, 4, 3] },
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
    // API: otwarte ZD w jednostkach dokumentu — w trybie paczek to paczki.
    otwarteZd: c.pack?.mode === "packages" ? c.onOrder / c.pack.units : c.onOrder,
    doZamowienia: 0,
  } as SubiektZdEstimateLine;
  if (c.stockout) {
    const meta = computeStockoutSalesFactor(c.stockout);
    const eff = meta ? stockoutMetaExcludingProsba(meta, Number(line.sprzedazOkres), c.prosba) : null;
    if (eff) line = applyStockoutAdjustToLine(line, eff, 0);
  }
  if (c.strategy === "max30_90") {
    // Profil: 12 okien po 30 d; ostatnie trzy dają sprzedaż z 90 d.
    const windows = [...(c.profileHistory ?? Array(9).fill(5)), ...c.floor];
    let b = line;
    const pm = resolveZdSalesProfile({
      windows,
      sprzedazOkres: Number(line.sprzedazOkres) || 0,
      dniOkresu: c.W,
      prosbaPieces: c.prosba,
      smoothing: true,
      smoothKinds: ["spike"],
    });
    if (pm.applied) b = applyZdSalesProfileToLine(line, { ...pm, smoothing: false }, 0);
    line = applyZdDemandFloorToLine(b, {
      policy: { strategy: "max30_90", targetDays: c.dni, cycleDays: 7 },
      sales90: sales90CappedFromProfile(windows, c.floorProsba),
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
    unitsPerPackage: c.pack?.units ?? null,
    documentUnitMode: c.pack?.mode ?? null,
  });
  if (!c.pack) return manual.doZamowieniaReczne;
  // Lista „Do ZD”: pełne paczki / wielokrotności — sztuki, które przyjadą.
  return resolveOrderQtyForLine(
    manual,
    { unitsPerPackage: c.pack.units, documentUnitMode: c.pack.mode, orderMultiple: c.pack.mult },
    0,
    false,
    "sum",
    0,
    0,
    c.minStock
  ).piecesArriving;
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
        profileHistory: c.profileHistory ?? Array(9).fill(5),
        stockout: c.stockout,
        dostepne: c.stock - c.reserved,
        onOrder: c.onOrder,
        trackPolicy: policyForBoostPreset(c.preset),
        lastOrder: c.history ? { qty: c.history.qty, linkedAt: new Date(nowMs - c.history.daysAgo * 86_400_000).toISOString() } : null,
        nowMs,
        minStock: c.minStock,
      });
      const pieces = c.pack
        ? zdBacktestPackPieces(bt.pieces, { unitsPerPackage: c.pack.units, documentUnitMode: c.pack.mode, orderMultiple: c.pack.mult })
        : bt.pieces;
      expect(pieces).toBe(engine(c, nowMs));
      if (c.pack && pieces > 0) {
        // przyjeżdżają pełne paczki (× wielokrotność), nie mniej niż potrzeba
        const step = c.pack.units * (c.pack.mode === "packages" ? (c.pack.mult ?? 1) : 1);
        expect(pieces % step).toBe(0);
        expect(pieces).toBeGreaterThanOrEqual(bt.pieces);
      }
    });
  }
  it("skok: zamówienie z typowego miesiąca, nie z całej jednorazowej sprzedaży", () => {
    const spike = cases.find((c) => c.name.startsWith("jednorazowy skok"))!;
    const noCap = engine({ ...spike, profileHistory: [0, 0, 0, 0, 0, 0, 0, 0, 0], floor: [0, 0, 34] }, nowMs);
    expect(engine(spike, nowMs)).toBeLessThan(10);
    expect(noCap).toBeGreaterThan(20);
  });
  it("scenariusze naprawdę coś zmieniają (test nie jest pusty)", () => {
    const qty = new Set(cases.map((c) => engine(c, nowMs)));
    expect(qty.size).toBeGreaterThan(6);
  });
});
