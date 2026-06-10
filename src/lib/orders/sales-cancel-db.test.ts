import { describe, expect, it } from "vitest";
import {
  buildSalesCancelUndoUpdate,
  buildSalesCancelUpdate,
  salesCancelOrderSelect,
} from "./sales-cancel-db";
import { salesCancelUndoRestoreStatus } from "./sales-cancel";

describe("sales-cancel-db", () => {
  it("salesCancelOrderSelect bez kolumn rezygnacji", () => {
    expect(salesCancelOrderSelect({ hasCancelledAt: false, hasCancelPhase: false })).not
      .toContain("sales_cancelled_at");
  });

  it("buildSalesCancelUpdate — legacy tylko before_order", () => {
    expect(
      buildSalesCancelUpdate(
        { hasCancelledAt: false, hasCancelPhase: false },
        "before_order",
        "2026-05-01"
      )
    ).toEqual({ status: "Anulowane", sales_acknowledged_at: "2026-05-01" });
    expect(
      buildSalesCancelUpdate(
        { hasCancelledAt: false, hasCancelPhase: false },
        "in_transit",
        "2026-05-01"
      )
    ).toBeNull();
  });

  it("buildSalesCancelUpdate — pełny schemat", () => {
    const u = buildSalesCancelUpdate(
      { hasCancelledAt: true, hasCancelPhase: true },
      "in_transit",
      "2026-05-01T00:00:00Z"
    );
    expect(u?.sales_cancelled_at).toBe("2026-05-01T00:00:00Z");
    expect(u?.sales_cancel_phase).toBe("in_transit");
    expect(u?.status).toBeUndefined();
    expect(u?.sales_acknowledged_at).toBe("2026-05-01T00:00:00Z");
  });

  it("buildSalesCancelUpdate — każda faza trafia od razu do archiwum", () => {
    for (const phase of ["before_order", "in_transit", "on_stock"] as const) {
      const u = buildSalesCancelUpdate(
        { hasCancelledAt: true, hasCancelPhase: true },
        phase,
        "2026-05-01T12:00:00Z"
      );
      expect(u?.sales_acknowledged_at).toBe("2026-05-01T12:00:00Z");
    }
    const before = buildSalesCancelUpdate(
      { hasCancelledAt: true, hasCancelPhase: true },
      "before_order",
      "2026-05-01T12:00:00Z"
    );
    expect(before?.status).toBe("Anulowane");
  });

  it("buildSalesCancelUndoUpdate — czyści rezygnację i przywraca status", () => {
    expect(
      buildSalesCancelUndoUpdate({ hasCancelledAt: true, hasCancelPhase: true }, "Nowe")
    ).toEqual({
      sales_acknowledged_at: null,
      sales_cancelled_at: null,
      sales_cancel_phase: null,
      status: "Nowe",
    });
    expect(
      buildSalesCancelUndoUpdate({ hasCancelledAt: true, hasCancelPhase: true }, null)
    ).toEqual({
      sales_acknowledged_at: null,
      sales_cancelled_at: null,
      sales_cancel_phase: null,
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
