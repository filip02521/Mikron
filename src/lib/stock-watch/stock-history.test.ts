import { describe, expect, it } from "vitest";
import {
  applyStockoutAdjustToLine,
  businessDaysInWindow,
  computeStockoutSalesFactor,
  stockoutMetaExcludingProsba,
} from "@/lib/stock-watch/stock-history";

describe("korekta sprzedaży o dni braku", () => {
  it("10 dni braku w 30: tempo × 30/20", () => {
    expect(computeStockoutSalesFactor({ windowDays: 30, recordedDays: 30, outDays: 10 })?.factor).toBeCloseTo(1.5);
  });

  it("bez dni braku, mało historii albo za mało dni ze stanem — bez korekty", () => {
    expect(computeStockoutSalesFactor({ windowDays: 30, recordedDays: 30, outDays: 0 })).toBeNull();
    expect(computeStockoutSalesFactor({ windowDays: 30, recordedDays: 20, outDays: 5 })).toBeNull();
    expect(computeStockoutSalesFactor({ windowDays: 30, recordedDays: 30, outDays: 25 })).toBeNull();
  });

  it("mnożnik ograniczony do 2×", () => {
    // 20 dni braku: 30/10 = 3 → 2.
    expect(computeStockoutSalesFactor({ windowDays: 30, recordedDays: 30, outDays: 20 })?.factor).toBe(2);
  });

  it("cel: skaluje część ze sprzedaży, zapas minimalny zostaje", () => {
    const meta = computeStockoutSalesFactor({ windowDays: 30, recordedDays: 30, outDays: 10 })!;
    const line = applyStockoutAdjustToLine({ sprzedazOkres: 20, sprzedazDziennie: 2 / 3, celZapasu: 25 }, meta, 5);
    expect(line.sprzedazOkres).toBeCloseTo(30);
    expect(line.celZapasu).toBeCloseTo(35);
    expect(line.stockoutAdjust.outDays).toBe(10);
  });
});

describe("dni robocze okna", () => {
  it("30 dni kalendarzowych = 22 dni robocze (21.09–20.10.2026)", () => {
    expect(businessDaysInWindow("2026-09-21", "2026-10-20")).toBe(22);
    expect(businessDaysInWindow("2026-10-24", "2026-10-25")).toBe(0);
  });
});

describe("dni braku a sprzedaż pod prośby", () => {
  const meta = { windowDays: 22, recordedDays: 22, outDays: 11, factor: 2 };

  it("cała sprzedaż pod prośby - bez korekty (nie ma fantomowego popytu)", () => {
    expect(stockoutMetaExcludingProsba(meta, 100, 100)).toBeNull();
  });

  it("część pod prośby - mnożnik tylko na sprzedaży na zapas", () => {
    // 60 na zapas × 2 + 40 prośby = 160 → 1,6 × 100.
    expect(stockoutMetaExcludingProsba(meta, 100, 40)?.factor).toBeCloseTo(1.6);
  });
});
