import { describe, expect, it } from "vitest";
import type { MyOrderRow } from "./my-order-presenter";
import { myOrderCollapsedMobileTiming } from "./my-order-collapsed-mobile-timing";

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

describe("myOrderCollapsedMobileTiming", () => {
  it("pokazuje termin na mobile gdy istotny i brak subline", () => {
    expect(
      myOrderCollapsedMobileTiming(row(), {
        expanded: false,
        showProgress: true,
        collapsedSubline: null,
      })
    ).toBe("ok. 10.05.2026 (~5 dni rob.)");
  });

  it("nie duplikuje subline", () => {
    expect(
      myOrderCollapsedMobileTiming(row(), {
        expanded: false,
        showProgress: true,
        collapsedSubline: "ok. 10.05.2026 (~5 dni rob.)",
      })
    ).toBeNull();
  });

  it("ukrywa po rozwinięciu", () => {
    expect(
      myOrderCollapsedMobileTiming(row(), {
        expanded: true,
        showProgress: true,
        collapsedSubline: null,
      })
    ).toBeNull();
  });
});
