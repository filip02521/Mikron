import { describe, expect, it } from "vitest";
import { buildStockWatchDashboard } from "@/lib/stock-watch/dashboard";
import type { StockWatchItem, StockWatchSupplierOrder } from "@/lib/stock-watch/data";

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
    salesPeriodQty: 30,
    salesPeriodDays: 30,
    velocityDaily: 1,
    velocityTrend: null,
    daysOfCover: 10,
    runOutDate: "2026-10-12",
    bufferDays: 30,
    targetQty: 30,
    minStockQty: null,
    inOrder: false,
    orderZdUnits: 0,
    orderUnitLabel: null,
    orderPieces: 0,
    orderIndividualPieces: 0,
    orderValue: null,
    unitPriceNet: null,
    dailyValue: null,
    deliveryRisk: null,
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

function order(over: Partial<StockWatchSupplierOrder>): StockWatchSupplierOrder {
  return {
    supplierId: "s1",
    supplierName: "Dostawca 1",
    runId: "r1",
    scopeMode: "grupa",
    scopeId: 10,
    dniZapasu: 30,
    dataOd: "2026-09-03",
    dataDo: "2026-10-02",
    lineCount: 0,
    zdUnitsSum: 0,
    orderValue: 0,
    unpricedCount: 0,
    explodeBomIncomplete: false,
    historyFetchFailed: false,
    pendingIndividualsError: null,
    truncated: false,
    leadDays: 7,
    leadSource: "p90",
    leadSamples: 6,
    nextOrderDate: "2026-10-20",
    nextOrderDays: 17,
    computedAt: "2026-10-03T05:30:00Z",
    ...over,
  };
}

const inOrder = (zdUnits: number, value: number | null) => ({
  inOrder: true,
  orderZdUnits: zdUnits,
  orderUnitLabel: "szt.",
  orderPieces: zdUnits,
  orderValue: value,
});

describe("buildStockWatchDashboard", () => {
  const items = [
    item({ subiektTwId: 1, status: "out_of_stock", daysOfCover: 0, dailyValue: 5, ...inOrder(10, 50) }),
    item({ subiektTwId: 2, status: "critical", daysOfCover: 1.5, velocityDaily: 3, ...inOrder(4, null) }),
    item({ subiektTwId: 3, status: "warning", supplierId: "s2", supplierName: "Dostawca 2", daysOfCover: 6, ...inOrder(2, 200) }),
    item({ subiektTwId: 4, status: "out_of_stock", rule: "excluded", velocityDaily: 9, ...inOrder(3, 30) }),
    // Prośba na „Na prośbę” — w liście Kreatora (extraOnly), więc w propozycji.
    item({ subiektTwId: 5, status: "out_of_stock", rule: "on_request", velocityDaily: 0.5, ...inOrder(1, 7), orderIndividualPieces: 1 }),
    // „Na prośbę” oznaczone po nocnym przebiegu, bez prośby — Kreator by go zdjął.
    item({ subiektTwId: 7, status: "warning", rule: "on_request", ...inOrder(5, 100) }),
    item({ subiektTwId: 6, status: "ok" }),
    // Ten sam towar u drugiego dostawcy (wspólny zakres) — jeden wiersz w sygnałach.
    item({ subiektTwId: 6, status: "ok", supplierId: "s2", supplierName: "Dostawca 2" }),
  ];
  const d = buildStockWatchDashboard(items, [
    order({ supplierId: "s1" }),
    order({ supplierId: "s2", supplierName: "Dostawca 2" }),
    order({ supplierId: "s3", supplierName: "Dostawca 3", explodeBomIncomplete: true }),
    order({ supplierId: "s4", supplierName: "Dostawca 4" }),
  ]);

  it("alerty: tylko Standard, brak przed krytycznym", () => {
    expect(d.alerts.map((a) => a.subiektTwId)).toEqual([1, 2]);
  });

  it("propozycje = lista „Do ZD” z silnika; wykluczone na żywo wypadają", () => {
    expect(d.proposals.map((p) => p.supplierId)).toEqual(["s1", "s2", "s3"]);
    expect(d.proposals[0]).toEqual(
      expect.objectContaining({
        lineCount: 3,
        zdUnitsSum: 15,
        orderValue: 57,
        unpricedCount: 1,
        outOfStockCount: 2,
        criticalCount: 1,
        mostUrgent: expect.objectContaining({ daysOfCover: 0 }),
      })
    );
    expect(d.proposals[1]).toEqual(expect.objectContaining({ lineCount: 1, orderValue: 200 }));
    expect(d.totals).toEqual(
      expect.objectContaining({ proposalValue: 257, proposalLines: 4, itemCount: 7, supplierCount: 2 })
    );
  });

  it("dostawca z ostrzeżeniem Kreatora widoczny mimo pustej listy", () => {
    expect(d.proposals.find((p) => p.supplierId === "s3")?.warnings[0]).toMatch(/BOM/);
    expect(d.proposals.some((p) => p.supplierId === "s4")).toBe(false);
  });

  it("top rotacji bez wykluczonych; flagi osobno", () => {
    expect(d.topVelocity[0]?.subiektTwId).toBe(2);
    expect(d.topVelocity.some((r) => r.rule === "excluded")).toBe(false);
    expect(d.flagged.map((f) => f.subiektTwId).sort()).toEqual([4, 5, 7]);
  });

  it("zdrowie liczone tylko ze Standard z rotacją, towar raz", () => {
    expect(d.health).toEqual({ score: 25, active: 4, ok: 1 });
    expect(d.counts).toEqual({
      outOfStock: 1,
      critical: 1,
      warning: 1,
      ok: 1,
      noSales: 0,
      beforeDelivery: 0,
      beforeNextDelivery: 0,
    });
  });
});

describe("buildStockWatchDashboard — czas dostawy", () => {
  const items = [
    // W normie wg celu, ale skończy się przed dostawą zamówienia złożonego dziś.
    item({ subiektTwId: 1, status: "ok", deliveryRisk: "before_delivery", daysOfCover: 5 }),
    item({ subiektTwId: 2, status: "ok", deliveryRisk: "before_next_delivery", daysOfCover: 20 }),
    item({ subiektTwId: 3, status: "ok", rule: "excluded", deliveryRisk: "before_delivery" }),
  ];
  const d = buildStockWatchDashboard(items, [order({ supplierId: "s1" })]);

  it("sygnał przed dostawą trafia do alertów i liczników (tylko Standard)", () => {
    expect(d.alerts.map((a) => a.subiektTwId)).toEqual([1]);
    expect(d.counts).toEqual(expect.objectContaining({ beforeDelivery: 1, beforeNextDelivery: 1 }));
  });

  it("dostawca z ryzykiem widoczny mimo pustej listy Do ZD, z danymi dostawy", () => {
    expect(d.proposals[0]).toEqual(
      expect.objectContaining({
        supplierId: "s1",
        lineCount: 0,
        beforeDeliveryCount: 1,
        beforeNextDeliveryCount: 1,
        leadDays: 7,
        nextOrderDays: 17,
      })
    );
  });
});

describe("buildStockWatchDashboard — limit czerwonej strefy", () => {
  it("„przed dostawą” ma własny limit — nie wypierają go setki braków", () => {
    const outs = Array.from({ length: 61 }, (_, i) =>
      item({ subiektTwId: 100 + i, status: "out_of_stock", daysOfCover: 0 })
    );
    const risk = item({ subiektTwId: 999, status: "ok", deliveryRisk: "before_delivery", daysOfCover: 3 });
    const d = buildStockWatchDashboard([...outs, risk], []);
    expect(d.alerts).toHaveLength(61);
    expect(d.alerts.some((a) => a.subiektTwId === 999)).toBe(true);
  });
});
