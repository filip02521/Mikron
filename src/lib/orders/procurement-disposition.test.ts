import { describe, expect, it } from "vitest";
import {
  needsProcurementCancelDisposition,
  procurementDispositionQueueLabel,
  procurementDispositionSummary,
} from "./procurement-disposition";
import type { IndividualOrder } from "@/types/database";

describe("procurement-disposition", () => {
  it("needsProcurementCancelDisposition gdy brak decyzji", () => {
    const o = {
      sales_cancelled_at: "t",
      sales_cancel_phase: "in_transit",
      procurement_cancel_disposition: null,
    } as IndividualOrder;
    expect(needsProcurementCancelDisposition(o)).toBe(true);
    expect(
      needsProcurementCancelDisposition({
        ...o,
        procurement_cancel_disposition: "return",
      } as IndividualOrder)
    ).toBe(false);
  });

  it("procurementDispositionSummary łączy etykietę i notatkę", () => {
    expect(
      procurementDispositionSummary("to_stock", "Regał B3")
    ).toBe("Na stan magazynu — Regał B3");
  });

  it("procurementDispositionQueueLabel ma prefix Zakupy", () => {
    const label = procurementDispositionQueueLabel({
      procurement_cancel_disposition: "return",
      procurement_cancel_disposition_note: "DHL 123",
    } as import("@/types/database").IndividualOrder);
    expect(label).toContain("Zakupy:");
    expect(label).toContain("zwrot");
  });
});
