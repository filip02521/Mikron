import { describe, expect, it } from "vitest";
import type {
  StockWatchDashboard,
  StockWatchSupplierBoardRow,
  StockWatchSupplierProposal,
} from "@/lib/stock-watch/dashboard";
import { buildStockWatchStatusLine, stockWatchPrepareZdHref } from "@/lib/stock-watch/status-line";

const zeroCounts: StockWatchDashboard["counts"] = {
  outOfStock: 0,
  emptyNoIncoming: 0,
  critical: 0,
  criticalInTransit: 0,
  warning: 0,
  ok: 0,
  noSales: 0,
  beforeDelivery: 0,
  beforeNextDelivery: 0,
};

function proposal(over: Partial<StockWatchSupplierProposal>): StockWatchSupplierProposal {
  return {
    supplierId: "s1",
    supplierName: "Dostawca 1",
    lineCount: 1,
    zdUnitsSum: 1,
    orderValue: 100,
    unpricedCount: 0,
    outOfStockCount: 0,
    criticalCount: 0,
    mostUrgent: null,
    dniZapasu: 30,
    dataOd: "2026-09-01",
    dataDo: "2026-09-30",
    computedAt: "2026-10-03T05:30:00Z",
    leadDays: 7,
    leadSource: "history",
    nextOrderDate: null,
    nextOrderDays: null,
    beforeDeliveryCount: 0,
    beforeNextDeliveryCount: 0,
    horizonExtends: false,
    warnings: [],
    ...over,
  };
}

function row(over: Partial<StockWatchSupplierBoardRow>): StockWatchSupplierBoardRow {
  return {
    supplierId: "s1",
    supplierName: "Dostawca 1",
    priority: "restock",
    orderValue: 0,
    proposal: null,
    urgentRows: [],
    urgentTotal: 0,
    emptyNoIncoming: 0,
    outOfStock: 0,
    critical: 0,
    criticalInTransit: 0,
    atRiskBeforeDelivery: 0,
    beforeDelivery: 0,
    beforeNextDelivery: 0,
    warning: 0,
    lineCount: 0,
    dataWarnings: 0,
    ...over,
  };
}

function dash(counts: Partial<StockWatchDashboard["counts"]>, suppliers: StockWatchSupplierBoardRow[] = []) {
  return {
    health: { score: 100, active: 0, ok: 0 },
    counts: { ...zeroCounts, ...counts },
    alerts: [],
    proposals: [],
    suppliers,
    quietSupplierCount: 0,
    topVelocity: [],
    flagged: [],
    totals: { proposalValue: 0, proposalLines: 0, itemCount: 1, supplierCount: 1 },
  } satisfies StockWatchDashboard;
}

describe("buildStockWatchStatusLine", () => {
  it("leads with empty shelves and points at the first urgent board row", () => {
    const line = buildStockWatchStatusLine(
      dash({ outOfStock: 3, emptyNoIncoming: 2, critical: 1, beforeDelivery: 2 }, [
        row({ supplierId: "hot", supplierName: "Pilny", priority: "now" }),
        row({ supplierId: "next", supplierName: "Dzisiaj", priority: "today" }),
        row({ supplierId: "calm", supplierName: "Spokojny", priority: "restock" }),
      ])
    );
    expect(line.tone).toBe("danger");
    expect(line.headline).toBe("2 towary bez stanu i bez dostawy w drodze");
    // 2 puste bez dostawy + 1 krytyczny + 2 przed dostawą; 1 brak w drodze się nie liczy.
    expect(line.urgentToday).toBe(5);
    expect(line.urgentSuppliers).toBe(2);
    expect(line.focus).toEqual({
      supplierId: "hot",
      supplierName: "Pilny",
      href: "/zakupy/szacunek?from=daily&supplierId=hot&autorun=1",
    });
  });

  it("does not count shortages that are already in transit as today's orders", () => {
    const line = buildStockWatchStatusLine(dash({ outOfStock: 1, beforeDelivery: 4 }));
    expect(line.headline).toBe("4 towary do zamówienia dziś");
    expect(line.urgentToday).toBe(4);
    expect(line.tone).toBe("warning");
    expect(line.focus).toBeNull();
  });

  it("says shortages wait for delivery when everything missing is already ordered", () => {
    const line = buildStockWatchStatusLine(dash({ outOfStock: 5 }, [row({ priority: "waiting", outOfStock: 5 })]));
    expect(line.headline).toBe("5 towarów czeka na dostawę z otwartych ZD");
    expect(line.tone).toBe("warning");
    expect(line.urgentToday).toBe(0);
    expect(line.focus).toBeNull();
  });

  it("is a warning when only the delivery-time signal fires, and opens the horizon option", () => {
    const line = buildStockWatchStatusLine(
      dash({ beforeDelivery: 1 }, [
        row({
          supplierId: "s9",
          priority: "today",
          proposal: proposal({ supplierId: "s9", lineCount: 0, beforeDeliveryCount: 1 }),
        }),
      ])
    );
    expect(line.tone).toBe("warning");
    expect(line.headline).toBe("1 towar do zamówienia dziś");
    expect(line.focus?.href).toBe("/zakupy/szacunek?from=daily&supplierId=s9&autorun=1&horizon=1");
  });

  it("falls back to below-target and then to all-clear; restock rows are not a focus", () => {
    const warn = buildStockWatchStatusLine(dash({ warning: 12 }, [row({ priority: "restock" })]));
    expect(warn.headline).toBe("Nic się dziś nie kończy · 12 towarów poniżej celu");
    expect(warn.focus).toBeNull();
    const ok = buildStockWatchStatusLine(dash({ ok: 40 }));
    expect(ok.tone).toBe("ok");
    expect(ok.focus).toBeNull();
  });
});

describe("stockWatchPrepareZdHref", () => {
  const base = "/zakupy/szacunek?from=daily&supplierId=s1&autorun=1";
  it("keeps the default horizon when the list has lines", () => {
    expect(stockWatchPrepareZdHref(proposal({ lineCount: 3, beforeNextDeliveryCount: 2, horizonExtends: true }))).toBe(base);
  });
  it("opens 'Do kolejnej dostawy' for an empty list with next-delivery risk the horizon covers", () => {
    expect(stockWatchPrepareZdHref(proposal({ lineCount: 0, beforeNextDeliveryCount: 2, horizonExtends: true }))).toBe(
      `${base}&horizon=1`
    );
  });
  it("keeps the default when the horizon would not change anything", () => {
    expect(stockWatchPrepareZdHref(proposal({ lineCount: 0, beforeNextDeliveryCount: 2, horizonExtends: false }))).toBe(base);
  });
});
