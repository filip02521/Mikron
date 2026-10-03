import { describe, expect, it } from "vitest";
import { buildStockWatchDashboard } from "@/lib/stock-watch/dashboard";
import type { StockWatchItem } from "@/lib/stock-watch/data";

function item(over: Partial<StockWatchItem>): StockWatchItem {
  return {
    subiektTwId: 1,
    supplierId: "s1",
    runId: "r1",
    twSymbol: "A",
    twNazwa: "Towar A",
    grtNazwa: null,
    scopeMode: "grupa",
    scopeId: 10,
    stockQty: 10,
    reservedQty: 0,
    availableQty: 10,
    openZdQty: 0,
    openZkUnreservedQty: 0,
    sales30d: 30,
    sales60d: 60,
    velocityDaily: 1,
    velocityTrend: 1,
    daysOfCover: 10,
    runOutDate: "2026-10-12",
    bufferDays: 14,
    safetyStockQty: 14,
    minStockQty: null,
    suggestedQty: 0,
    unitPriceNet: null,
    dailyValue: null,
    status: "ok",
    computedAt: "2026-10-03T05:30:00Z",
    supplierName: "Dostawca 1",
    rule: "standard",
    ruleNote: null,
    priceDokNr: null,
    priceDate: null,
    ...over,
  };
}

describe("buildStockWatchDashboard", () => {
  const items = [
    item({ subiektTwId: 1, status: "out_of_stock", suggestedQty: 10, unitPriceNet: 5, daysOfCover: 0, dailyValue: 5 }),
    item({ subiektTwId: 2, status: "critical", suggestedQty: 4, unitPriceNet: null, daysOfCover: 1.5, velocityDaily: 3 }),
    item({ subiektTwId: 3, status: "warning", suggestedQty: 2, unitPriceNet: 100, supplierId: "s2", supplierName: "Dostawca 2", daysOfCover: 6 }),
    item({ subiektTwId: 4, status: "out_of_stock", suggestedQty: 0, rule: "excluded", velocityDaily: 9 }),
    item({ subiektTwId: 5, status: "out_of_stock", suggestedQty: 0, rule: "on_request", velocityDaily: 0.5 }),
    item({ subiektTwId: 6, status: "ok" }),
  ];
  const d = buildStockWatchDashboard(items, new Map([["s2", "draft-1"]]));

  it("alerty: tylko Standard, brak przed krytycznym", () => {
    expect(d.alerts.map((a) => a.subiektTwId)).toEqual([1, 2]);
  });

  it("propozycje po dostawcach: SKU, wartość z cen, pozycje bez ceny, otwarty szkic", () => {
    expect(d.proposals).toEqual([
      expect.objectContaining({
        supplierId: "s1",
        skuCount: 2,
        outOfStockCount: 1,
        criticalCount: 1,
        estimatedValue: 50,
        unpricedCount: 1,
        openDraftId: null,
        mostUrgent: expect.objectContaining({ daysOfCover: 0 }),
      }),
      expect.objectContaining({
        supplierId: "s2",
        skuCount: 1,
        estimatedValue: 200,
        openDraftId: "draft-1",
      }),
    ]);
    expect(d.totals.proposalValue).toBe(250);
  });

  it("top rotacji bez wykluczonych; flagi osobno", () => {
    expect(d.topVelocity[0]?.subiektTwId).toBe(2);
    expect(d.topVelocity.some((r) => r.rule === "excluded")).toBe(false);
    expect(d.flagged.map((f) => f.subiektTwId).sort()).toEqual([4, 5]);
  });

  it("zdrowie liczone tylko ze Standard z rotacją", () => {
    expect(d.health).toEqual({ score: 25, active: 4, ok: 1 });
    expect(d.counts).toEqual({ outOfStock: 1, critical: 1, warning: 1, ok: 1, noSales: 0 });
  });
});
