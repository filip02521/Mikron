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
    bomRole: null,
    pairRole: null,
    assemblyKind: null,
    assemblyQty: null,
    assemblyNote: null,
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
      emptyNoIncoming: 1,
      critical: 1,
      criticalInTransit: 0,
      warning: 1,
      toAssemble: 0,
      ok: 1,
      noSales: 0,
      beforeDelivery: 0,
      beforeNextDelivery: 0,
    });
  });

  it("emptyNoIncoming: brak na stanie i bez otwartego ZD", () => {
    const withIncoming = buildStockWatchDashboard(
      [
        item({
          subiektTwId: 1,
          status: "out_of_stock",
          availableQty: 0,
          openZdQty: 12,
          daysOfCover: 0,
        }),
        item({
          subiektTwId: 2,
          status: "out_of_stock",
          availableQty: 0,
          openZdQty: 0,
          daysOfCover: 0,
        }),
      ],
      []
    );
    expect(withIncoming.counts.outOfStock).toBe(2);
    expect(withIncoming.counts.emptyNoIncoming).toBe(1);
    // Puste bez dostawy przed brakiem z towarem w drodze.
    expect(withIncoming.alerts.map((a) => a.subiektTwId)).toEqual([2, 1]);
  });
});

describe("buildStockWatchDashboard - czas dostawy", () => {
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
        horizonExtends: false,
      })
    );
  });
});

describe("buildStockWatchDashboard - limit czerwonej strefy", () => {
  it("„przed dostawą” ma własny limit - nie wypierają go setki braków", () => {
    const outs = Array.from({ length: 61 }, (_, i) =>
      item({ subiektTwId: 100 + i, status: "out_of_stock", daysOfCover: 0 })
    );
    const risk = item({ subiektTwId: 999, status: "ok", deliveryRisk: "before_delivery", daysOfCover: 3 });
    const d = buildStockWatchDashboard([...outs, risk], []);
    expect(d.alerts).toHaveLength(61);
    expect(d.alerts.some((a) => a.subiektTwId === 999)).toBe(true);
  });
});

describe("buildStockWatchDashboard - filtr dostawcy", () => {
  it("pilne pozycje dostawcy nie wypadają za globalny limit alertów", () => {
    // 200 braków u s1 wypełnia limit; jedyny brak s2 musi być widoczny po filtrze.
    const many = Array.from({ length: 200 }, (_, i) =>
      item({ subiektTwId: 1000 + i, status: "out_of_stock", availableQty: 0, daysOfCover: 0 })
    );
    const s2 = item({
      subiektTwId: 5,
      supplierId: "s2",
      status: "critical",
      daysOfCover: 1.5,
      velocityDaily: 0.01,
    });
    const all = buildStockWatchDashboard([...many, s2], []);
    expect(all.alerts.some((r) => r.supplierId === "s2")).toBe(false);
    const filtered = buildStockWatchDashboard([...many, s2], [], { alertsSupplierId: "s2" });
    expect(filtered.alerts.map((r) => r.supplierId)).toEqual(["s2"]);
  });
});

describe("buildStockWatchDashboard — tablica dostawców", () => {
  const items = [
    // Duży dostawca: dużo braków, ale wszystko już jedzie.
    item({ subiektTwId: 10, supplierId: "big", supplierName: "Duży", status: "out_of_stock", openZdQty: 5 }),
    item({ subiektTwId: 11, supplierId: "big", supplierName: "Duży", status: "out_of_stock", openZdQty: 3 }),
    // Mały dostawca: jedna pusta półka bez dostawy — ma być wyżej.
    item({ subiektTwId: 20, supplierId: "small", supplierName: "Mały", status: "out_of_stock", openZdQty: 0, ...inOrder(2, 40) }),
    // Ryzyko przed dostawą.
    item({ subiektTwId: 30, supplierId: "lead", supplierName: "Daleki", status: "warning", deliveryRisk: "before_delivery", ...inOrder(1, 10) }),
    // Tylko poniżej celu.
    item({ subiektTwId: 40, supplierId: "restock", supplierName: "Uzupełnienie", status: "warning", ...inOrder(3, 90) }),
    // Wykluczony towar nie robi priorytetu.
    item({ subiektTwId: 50, supplierId: "excluded", supplierName: "Wykluczony", status: "out_of_stock", rule: "excluded" }),
    item({ subiektTwId: 60, supplierId: "quiet", supplierName: "Spokojny", status: "ok" }),
  ];
  const d = buildStockWatchDashboard(items, [
    order({ supplierId: "small", supplierName: "Mały" }),
    order({ supplierId: "lead", supplierName: "Daleki" }),
    order({ supplierId: "restock", supplierName: "Uzupełnienie" }),
  ]);

  it("orders suppliers by priority, not by the size of their shortage list", () => {
    expect(d.suppliers.map((s) => [s.supplierId, s.priority])).toEqual([
      ["small", "now"],
      ["lead", "today"],
      ["restock", "restock"],
      ["big", "waiting"],
    ]);
    expect(d.quietSupplierCount).toBe(2);
  });

  it("shows a supplier whose only problem is a Kreator warning, as 'attention'", () => {
    const withWarning = buildStockWatchDashboard(
      [item({ subiektTwId: 70, supplierId: "bom", supplierName: "Komplety", status: "ok" })],
      [order({ supplierId: "bom", supplierName: "Komplety", explodeBomIncomplete: true })]
    );
    expect(withWarning.suppliers.map((s) => [s.supplierId, s.priority, s.dataWarnings])).toEqual([["bom", "attention", 1]]);
    expect(withWarning.quietSupplierCount).toBe(0);
  });

  it("counts a shared-scope product only at the supplier that orders it", () => {
    const shared = buildStockWatchDashboard(
      [
        item({ subiektTwId: 80, supplierId: "a", supplierName: "A", status: "out_of_stock", ...inOrder(2, 20) }),
        item({ subiektTwId: 80, supplierId: "b", supplierName: "B", status: "out_of_stock" }),
      ],
      [order({ supplierId: "a", supplierName: "A" }), order({ supplierId: "b", supplierName: "B" })]
    );
    expect(shared.suppliers.map((s) => [s.supplierId, s.emptyNoIncoming])).toEqual([["a", 1]]);
  });

  it("lists next-delivery risks in the expansion of a 'soon' supplier", () => {
    const soon = buildStockWatchDashboard(
      [item({ subiektTwId: 90, supplierId: "n", supplierName: "N", status: "warning", deliveryRisk: "before_next_delivery" })],
      [order({ supplierId: "n", supplierName: "N" })]
    );
    expect(soon.suppliers[0]?.priority).toBe("soon");
    expect(soon.suppliers[0]?.urgentRows.map((r) => r.subiektTwId)).toEqual([90]);
  });

  it("carries the supplier's urgent rows and the proposal for the row action", () => {
    const small = d.suppliers[0]!;
    expect(small.emptyNoIncoming).toBe(1);
    expect(small.urgentRows.map((r) => r.subiektTwId)).toEqual([20]);
    expect(small.proposal?.lineCount).toBe(1);
    const big = d.suppliers.find((s) => s.supplierId === "big")!;
    expect([big.outOfStock, big.emptyNoIncoming, big.urgentTotal]).toEqual([2, 0, 2]);
  });
});

describe("≤ 48 h z towarem w drodze nie jest „do zamówienia dziś”", () => {
  const board = (over: Partial<StockWatchItem>) =>
    buildStockWatchDashboard(
      [item({ subiektTwId: 95, supplierId: "z", supplierName: "Z", status: "critical", ...over })],
      [order({ supplierId: "z", supplierName: "Z" })]
    );

  it("nic w drodze → Teraz", () => {
    const d = board({ openZdQty: 0 });
    expect(d.suppliers[0]?.priority).toBe("now");
    expect(d.counts.critical).toBe(1);
  });

  it("ZD w drodze i zdąży → czeka na dostawę (nie znika z tablicy)", () => {
    const d = board({ openZdQty: 500 });
    expect(d.counts.critical).toBe(0);
    expect(d.counts.criticalInTransit).toBe(1);
    expect(d.counts.beforeDelivery).toBe(0);
    expect(d.suppliers[0]?.priority).toBe("waiting");
  });

  it("ryzyko przed dostawą liczone szeroko dla sygnału panelu (także ≤ 48 h bez dostawy)", () => {
    const d = board({ openZdQty: 0, deliveryRisk: "before_delivery" });
    expect(d.suppliers[0]?.beforeDelivery).toBe(0);
    expect(d.suppliers[0]?.atRiskBeforeDelivery).toBe(1);
  });

  it("ZD w drodze, ale nie zdąży → Dziś", () => {
    const d = board({ openZdQty: 500, deliveryRisk: "before_delivery" });
    expect(d.counts.critical).toBe(0);
    expect(d.counts.beforeDelivery).toBe(1);
    expect(d.suppliers[0]?.priority).toBe("today");
  });
});

describe("zestaw „Składamy” w liczbach panelu", () => {
  it("brak zestawu nie jest osobną pilną pozycją - niosą go składniki", () => {
    const d = buildStockWatchDashboard(
      [
        item({ subiektTwId: 100, bomRole: "assembled_parent", status: "out_of_stock", availableQty: 0 }),
        item({ subiektTwId: 1, bomRole: "component", status: "out_of_stock", availableQty: 0, inOrder: true }),
        item({ subiektTwId: 101, bomRole: "assembled_parent", status: "to_assemble", availableQty: 0 }),
      ],
      [order({ lineCount: 1 })]
    );
    expect(d.counts.outOfStock).toBe(1);
    expect(d.alerts.map((r) => r.subiektTwId)).toEqual([1]);
    expect(d.counts.toAssemble).toBe(1);
    expect(d.assembly.map((r) => r.subiektTwId)).toEqual([101]);
    expect(d.topVelocity.some((r) => r.bomRole === "assembled_parent")).toBe(false);
    expect(d.suppliers[0]?.outOfStock).toBe(1);
  });
});

describe("buildStockWatchDashboard — wiersz dostawcy zgodny z „Lista braków dostawcy”", () => {
  // Wiersz pisze „Pokazano X najpilniejszych z N — pełna lista w »Lista braków dostawcy«”:
  // N i pokazane pozycje muszą być dokładnie tą listą (zgłoszenie: 45 w wierszu, 32 na liście).
  const many = Array.from({ length: 70 }, (_, i) =>
    item({ subiektTwId: 2000 + i, supplierId: "s1", status: "out_of_stock", availableQty: 0, daysOfCover: 0 })
  );
  const mixed = [
    ...many,
    item({ subiektTwId: 1, supplierId: "s1", status: "warning", deliveryRisk: "before_next_delivery", daysOfCover: 12 }),
    item({ subiektTwId: 2, supplierId: "s1", status: "critical", openZdQty: 5, daysOfCover: 1 }),
    item({ subiektTwId: 3, supplierId: "s1", status: "warning", deliveryRisk: "before_delivery", daysOfCover: 4 }),
    item({ subiektTwId: 4, supplierId: "s1", status: "critical", openZdQty: 0, daysOfCover: 1 }),
    // Wspólny towar: liczy się u właściciela (s2 ma go w ZD), nie u s1.
    item({ subiektTwId: 5, supplierId: "s1", status: "out_of_stock", availableQty: 0 }),
    item({ subiektTwId: 5, supplierId: "s2", supplierName: "Dostawca 2", status: "out_of_stock", availableQty: 0, inOrder: true, orderZdUnits: 2, orderPieces: 2 }),
  ];

  it("licznik i pokazane pozycje wiersza = lista dostawcy po filtrze", () => {
    const board = buildStockWatchDashboard(mixed, []);
    for (const row of board.suppliers.filter((s) => s.urgentTotal > 0)) {
      const list = buildStockWatchDashboard(mixed, [], { alertsSupplierId: row.supplierId }).alerts;
      expect(list.length, row.supplierId).toBe(row.urgentTotal);
      const listTw = new Set(list.map((r) => r.subiektTwId));
      for (const r of row.urgentRows) expect(listTw.has(r.subiektTwId), `${row.supplierId}/${r.subiektTwId}`).toBe(true);
    }
  });

  it("lista jednego dostawcy nie jest ucinana do globalnego limitu", () => {
    const list = buildStockWatchDashboard(mixed, [], { alertsSupplierId: "s1" }).alerts;
    expect(list.filter((r) => r.status === "out_of_stock").length).toBe(70);
  });
});
