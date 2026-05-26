import { describe, expect, it } from "vitest";
import { editInitialFromMyOrderRow } from "./individual-request-edit-ui";
import type { MyOrderRow } from "./my-order-presenter";

function minimalRow(overrides: Partial<MyOrderRow> = {}): MyOrderRow {
  return {
    id: "g1",
    kind: "zamowienie",
    lineCount: 1,
    lines: [
      {
        id: "o1",
        product: "Wkręt",
        symbol: "A1",
        subiektTwId: 42,
        quantity: "2",
        quantityLabel: "2 szt.",
        progressLabel: null,
        stockStatus: "waiting",
        canAcknowledgePickup: false,
        clientName: null,
      },
    ],
    supplierId: "sup-1",
    salesPersonId: "sp-1",
    requestKind: "zamowienie",
    headline: "Test",
    productSummary: "Wkręt",
    statusLabel: "Zamówione",
    statusTone: "default",
    orderedAtLabel: null,
    deliveryEtaLabel: null,
    subiektZdLabel: null,
    subiektZdHint: null,
    acknowledgeMode: "none",
    canCancelBySales: false,
    canEditBySales: true,
    orderIds: ["o1"],
    salesCancelPhase: null,
    salesCancelOrderIds: [],
    cancelNoticeOrderIds: [],
    cancelledAckOrderIds: [],
    clientLabel: null,
    pickupPendingCount: 0,
    pickupPendingIds: [],
    pickupReadyTotal: 0,
    pickupAcknowledgedCount: 0,
    ...overrides,
  };
}

describe("editInitialFromMyOrderRow", () => {
  it("zachowuje subiektTwId przy edycji prośby handlowca", () => {
    const initial = editInitialFromMyOrderRow(minimalRow());
    expect(initial?.lines[0]?.subiektTwId).toBe(42);
  });
});
