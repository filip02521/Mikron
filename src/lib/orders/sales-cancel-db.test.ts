import { describe, expect, it } from "vitest";
import {
  buildSalesCancelUndoUpdate,
  buildSalesCancelUpdate,
  salesCancelOrderSelect,
} from "./sales-cancel-db";
import { salesCancelUndoRestoreStatus } from "./sales-cancel";

describe("sales-cancel-db", () => {
  it("salesCancelOrderSelect bez kolumn rezygnacji", () => {
    expect(
      salesCancelOrderSelect({
        hasCancelledAt: false,
        hasCancelPhase: false,
        hasCancelledQuantity: false,
      })
    ).not.toContain("sales_cancelled_at");
  });

  it("buildSalesCancelUpdate — legacy tylko before_order", () => {
    expect(
      buildSalesCancelUpdate(
        { hasCancelledAt: false, hasCancelPhase: false, hasCancelledQuantity: false },
        "before_order",
        "2026-05-01"
      )
    ).toEqual({ status: "Anulowane", sales_acknowledged_at: "2026-05-01" });
    expect(
      buildSalesCancelUpdate(
        { hasCancelledAt: false, hasCancelPhase: false, hasCancelledQuantity: false },
        "in_transit",
        "2026-05-01"
      )
    ).toBeNull();
  });

  it("buildSalesCancelUpdate — pełny schemat", () => {
    const u = buildSalesCancelUpdate(
      { hasCancelledAt: true, hasCancelPhase: true, hasCancelledQuantity: true },
      "in_transit",
      "2026-05-01T00:00:00Z"
    );
    expect(u?.sales_cancelled_at).toBe("2026-05-01T00:00:00Z");
    expect(u?.sales_cancel_phase).toBe("in_transit");
    expect(u?.status).toBeUndefined();
    expect(u?.sales_acknowledged_at).toBe("2026-05-01T00:00:00Z");
  });

  it("buildSalesCancelUpdate — częściowa rezygnacja przed zamówieniem nie anuluje wiersza", () => {
    const u = buildSalesCancelUpdate(
      { hasCancelledAt: true, hasCancelPhase: true, hasCancelledQuantity: true },
      "before_order",
      "2026-05-01T00:00:00Z",
      {
        storedCancelledQuantity: "2",
        statusAfter: undefined,
        keepLineActiveForSales: true,
      }
    );
    expect(u?.status).toBeUndefined();
    expect(u?.sales_cancelled_quantity).toBe("2");
    expect(u?.sales_acknowledged_at).toBeUndefined();
    expect(u?.sales_cancelled_at).toBe("2026-05-01T00:00:00Z");
  });

  it("buildSalesCancelUpdate — Dentalstore: rezygnacja z reszty bez archiwum", () => {
    const u = buildSalesCancelUpdate(
      { hasCancelledAt: true, hasCancelPhase: true, hasCancelledQuantity: true },
      "on_stock",
      "2026-05-01T00:00:00Z",
      {
        storedCancelledQuantity: "3",
        statusAfter: "Zrealizowane",
        keepLineActiveForSales: true,
      }
    );
    expect(u?.status).toBe("Zrealizowane");
    expect(u?.sales_acknowledged_at).toBeUndefined();
  });

  it("buildSalesCancelUpdate — każda faza trafia od razu do archiwum", () => {
    for (const phase of ["before_order", "in_transit", "on_stock"] as const) {
      const u = buildSalesCancelUpdate(
        { hasCancelledAt: true, hasCancelPhase: true, hasCancelledQuantity: true },
        phase,
        "2026-05-01T12:00:00Z"
      );
      expect(u?.sales_acknowledged_at).toBe("2026-05-01T12:00:00Z");
    }
    const before = buildSalesCancelUpdate(
      { hasCancelledAt: true, hasCancelPhase: true, hasCancelledQuantity: true },
      "before_order",
      "2026-05-01T12:00:00Z"
    );
    expect(before?.status).toBe("Anulowane");
  });

  it("buildSalesCancelUndoUpdate — czyści rezygnację i przywraca status", () => {
    expect(
      buildSalesCancelUndoUpdate(
        { hasCancelledAt: true, hasCancelPhase: true, hasCancelledQuantity: true },
        "Nowe"
      )
    ).toEqual({
      sales_acknowledged_at: null,
      sales_cancelled_at: null,
      sales_cancel_phase: null,
      sales_cancelled_quantity: null,
      status: "Nowe",
    });
    expect(
      buildSalesCancelUndoUpdate(
        { hasCancelledAt: true, hasCancelPhase: true, hasCancelledQuantity: true },
        null
      )
    ).toEqual({
      sales_acknowledged_at: null,
      sales_cancelled_at: null,
      sales_cancel_phase: null,
      sales_cancelled_quantity: null,
    });
  });

  it("buildSalesCancelUndoUpdate — przywraca poprzednią częściową rezygnację", () => {
    expect(
      buildSalesCancelUndoUpdate(
        { hasCancelledAt: true, hasCancelPhase: true, hasCancelledQuantity: true },
        null,
        {
          sales_cancelled_at: "2026-06-01T10:00:00Z",
          sales_cancelled_quantity: "2",
          sales_cancel_phase: "in_transit",
          status: "Zamowione",
        }
      )
    ).toEqual({
      sales_acknowledged_at: null,
      sales_cancelled_at: "2026-06-01T10:00:00Z",
      sales_cancel_phase: "in_transit",
      sales_cancelled_quantity: "2",
      status: "Zamowione",
    });
  });

  it("salesCancelUndoRestoreStatus — tylko before_order z Anulowane", () => {
    expect(
      salesCancelUndoRestoreStatus(
        { status: "Anulowane", request_kind: "zamowienie" },
        "before_order"
      )
    ).toBe("Nowe");
    expect(
      salesCancelUndoRestoreStatus(
        { status: "Zamowione", request_kind: "zamowienie" },
        "in_transit"
      )
    ).toBeNull();
  });
});
