import { describe, expect, it } from "vitest";
import { pickupProgressLabel } from "./pickup-progress-label";
import type { MyOrderRow } from "./my-order-presenter";

function row(partial: Partial<MyOrderRow>): MyOrderRow {
  return {
    id: "g1",
    kind: "zamowienie",
    lineCount: 5,
    lines: [],
    submittedLabel: "01.05.2026",
    supplierName: "X",
    product: "5 produktów",
    symbol: null,
    quantityLabel: "",
    progressLabel: null,
    statusTitle: "Gotowe",
    statusDetail: null,
    timingLabel: null,
    badgeVariant: "success",
    rowColor: "#000",
    orderIds: [],
    acknowledgeMode: "pickup",
    pickupPendingCount: 3,
    pickupPendingIds: ["a", "b", "c"],
    pickupReadyTotal: 5,
    pickupAcknowledgedCount: 2,
    canCancelBySales: false,
    salesCancelPhase: null,
    salesCancelOrderIds: [],
    cancelNoticeOrderIds: [],
    cancelledAckOrderIds: [],
    clientLabel: null,
    supplierId: null,
    salesPersonId: "sp1",
    requestKind: "zamowienie",
    canEditBySales: false,
    ...partial,
  };
}

describe("pickupProgressLabel", () => {
  it("pokazuje X/Y odebrane gdy część potwierdzona", () => {
    expect(pickupProgressLabel(row({}))).toBe("2/5 odebrane");
  });

  it("pokazuje liczbę do odbioru gdy nic nie potwierdzono", () => {
    expect(
      pickupProgressLabel(
        row({ pickupAcknowledgedCount: 0, pickupPendingCount: 5 })
      )
    ).toBe("5 poz. do odbioru");
  });

  it("nie pokazuje dla pojedynczej pozycji", () => {
    expect(pickupProgressLabel(row({ pickupReadyTotal: 1 }))).toBeNull();
  });
});
