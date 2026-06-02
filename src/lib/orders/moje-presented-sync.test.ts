import { describe, expect, it } from "vitest";
import { mojePresentedSignature } from "./moje-presented-sync";
import type { MyOrderRow } from "@/lib/orders/my-order-presenter";

function minimalRow(overrides: Partial<MyOrderRow> = {}): MyOrderRow {
  return {
    id: "row-1",
    kind: "zamowienie",
    lineCount: 1,
    lines: [
      {
        id: "o1",
        product: "P",
        symbol: null,
        subiektTwId: null,
        mikranCode: null,
        quantity: "1",
        quantityLabel: "1 szt.",
        progressLabel: null,
        stockStatus: "waiting",
        canAcknowledgePickup: false,
        clientName: null,
        clientKhId: null,
      },
    ],
    submittedLabel: "01.05.2026",
    supplierName: "Dostawca",
    product: "P",
    symbol: null,
    quantityLabel: "1 szt.",
    progressLabel: null,
    statusTitle: "Zamówione",
    statusDetail: null,
    timingLabel: null,
    badgeVariant: "info",
    rowColor: "#fff",
    orderIds: ["o1"],
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
    supplierId: "s1",
    salesPersonId: "sp1",
    requestKind: "zamowienie",
    canEditBySales: false,
    ...overrides,
  };
}

describe("mojePresentedSignature", () => {
  it("różni się po zmianie clientLabel / clientName przy tych samych id", () => {
    const base = { zamowienia: [minimalRow()], informacje: [] };
    const withClient = {
      zamowienia: [
        minimalRow({
          clientLabel: "Kowalski",
          lines: [
            {
              ...minimalRow().lines[0],
              clientName: "Kowalski",
            },
          ],
        }),
      ],
      informacje: [],
    };
    expect(mojePresentedSignature(base)).not.toBe(mojePresentedSignature(withClient));
  });
});
