import { describe, expect, it } from "vitest";
import { filterMyOrderRowsByClient } from "./my-order-client-filter";
import type { MyOrderRow } from "@/lib/orders/my-order-presenter";

function row(partial: Partial<MyOrderRow>): MyOrderRow {
  return {
    id: "r1",
    kind: "zamowienie",
    lineCount: 1,
    lines: [],
    submittedLabel: "",
    supplierName: "Dostawca",
    product: "Szczotka",
    symbol: null,
    quantityLabel: "1",
    progressLabel: null,
    statusTitle: "Zamówione",
    statusDetail: null,
    timingLabel: null,
    badgeVariant: "info",
    rowColor: "",
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
    clientLabel: "Walczak Jacek",
    supplierId: "s1",
    salesPersonId: "sp1",
    requestKind: "zamowienie",
    canEditBySales: true,
    ...partial,
  };
}

describe("filterMyOrderRowsByClient", () => {
  it("filtruje po nazwie klienta", () => {
    const rows = [
      row({ id: "a", clientLabel: "Walczak Jacek" }),
      row({ id: "b", clientLabel: "Kowalski" }),
    ];
    expect(filterMyOrderRowsByClient(rows, "walczak").map((r) => r.id)).toEqual(["a"]);
  });
});
