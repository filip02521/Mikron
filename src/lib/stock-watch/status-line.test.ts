import { describe, expect, it } from "vitest";
import type {
  StockWatchDashboard,
  StockWatchSupplierBoardRow,
  StockWatchSupplierProposal,
} from "@/lib/stock-watch/dashboard";
import { buildStockWatchStatusLine } from "@/lib/stock-watch/status-line";

const zeroCounts: StockWatchDashboard["counts"] = {
  outOfStock: 0,
  emptyNoIncoming: 0,
  critical: 0,
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
    beforeDelivery: 0,
    beforeNextDelivery: 0,
    warning: 0,
    lineCount: 0,
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
    expect(line.urgentToday).toBe(6);
    expect(line.urgentSuppliers).toBe(2);
    expect(line.focus).toEqual({
      supplierId: "hot",
      supplierName: "Pilny",
      href: "/zakupy/szacunek?from=daily&supplierId=hot&autorun=1",
    });
  });

  it("counts today's orders when everything empty already has an incoming ZD", () => {
    const line = buildStockWatchStatusLine(dash({ outOfStock: 1, beforeDelivery: 4 }));
    expect(line.headline).toBe("5 towarów do zamówienia dziś");
    expect(line.tone).toBe("danger");
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
