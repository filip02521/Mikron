import { describe, expect, it } from "vitest";
import type { MyOrderRow } from "./my-order-presenter";
import {
  buildMyOrderDeliveryTimingDisplay,
  parseMyOrderTimingLabel,
  shouldShowMyOrderExpandedDeliveryTiming,
} from "./my-order-delivery-timing-display";

function row(extra: Partial<MyOrderRow> = {}): MyOrderRow {
  return {
    id: "1",
    kind: "zamowienie",
    lineCount: 1,
    lines: [],
    submittedLabel: "01.05",
    supplierName: "Dostawca",
    product: "P",
    symbol: null,
    quantityLabel: "2 szt.",
    progressLabel: null,
    statusTitle: "Zamówione",
    statusDetail: null,
    timingLabel: "ok. 10.05.2026 (~5 dni rob.)",
    badgeVariant: "info",
    rowColor: "#fff",
    orderIds: ["1"],
    acknowledgeMode: "none",
    pickupPendingCount: 0,
    pickupPendingIds: [],
    pickupReadyTotal: 0,
    pickupAcknowledgedCount: 0,
    canCancelBySales: false,
    salesCancelPhase: null,
    salesCancelOrderIds: [],
    cancelNoticeOrderIds: [],
    cancelledAckOrderIds: [],
    clientLabel: null,
    supplierId: "s",
    salesPersonId: "sp",
    requestKind: "zamowienie",
    canEditBySales: false,
    headline: "Zamówione — czekamy na dostawę",
    headlineTone: "info",
    subline: null,
    ...extra,
  };
}

describe("my-order-delivery-timing-display", () => {
  it("parsuje timingLabel", () => {
    expect(parseMyOrderTimingLabel("ok. 10.05.2026 (~5 dni rob.) · mało historii · po terminie")).toEqual({
      estimate: "ok. 10.05.2026 (~5 dni rob.)",
      overdue: true,
      lowConfidence: true,
    });
  });

  it("buduje blok dla opóźnienia", () => {
    const display = buildMyOrderDeliveryTimingDisplay(
      row({ timingLabel: "ok. 10.05.2026 (~5 dni rob.) · po terminie" })
    );
    expect(display?.title).toBe("Termin u dostawcy minął");
    expect(display?.tone).toBe("overdue");
  });

  it("pokazuje blok w rozwinięciu dla zamówienia z ETA", () => {
    expect(shouldShowMyOrderExpandedDeliveryTiming(row(), true)).toBe(true);
    expect(shouldShowMyOrderExpandedDeliveryTiming(row(), false)).toBe(false);
    expect(shouldShowMyOrderExpandedDeliveryTiming(row({ kind: "informacja" }), true)).toBe(
      false
    );
    expect(
      shouldShowMyOrderExpandedDeliveryTiming(row({ acknowledgeMode: "pickup" }), true)
    ).toBe(false);
  });
});
