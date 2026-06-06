import { describe, expect, it } from "vitest";
import { filterMyOrderRowsByClientLink } from "./moje-client-link-filter";
import type { MyOrderRow } from "@/lib/orders/my-order-presenter";

function row(partial: Partial<MyOrderRow> & { lines: MyOrderRow["lines"] }): MyOrderRow {
  return {
    id: "r1",
    kind: "zamowienie",
    lineCount: partial.lines.length,
    submittedLabel: "",
    supplierName: "Dostawca",
    product: "P",
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
    clientLabel: "Klinika Smile",
    supplierId: "s1",
    salesPersonId: "sp1",
    requestKind: "zamowienie",
    canEditBySales: true,
    ...partial,
  };
}

describe("filterMyOrderRowsByClientLink", () => {
  it("dopasowuje po kh na pozycji", () => {
    const rows = [
      row({
        id: "a",
        lines: [
          {
            id: "l1",
            product: "P",
            symbol: null,
            subiektTwId: null,
            mikranCode: null,
            quantity: "1",
            quantityLabel: "1",
            progressLabel: null,
            stockStatus: "waiting",
            canAcknowledgePickup: false,
            clientName: "Inna",
            clientKhId: 42,
          },
        ],
      }),
    ];
    expect(
      filterMyOrderRowsByClientLink(rows, { khId: 42, clientLabel: "Klinika Smile" }).map(
        (r) => r.id
      )
    ).toEqual(["a"]);
  });

  it("dopasowuje po nazwie gdy prośba nie ma kh (jak notatnik ZK)", () => {
    const rows = [
      row({
        id: "a",
        clientLabel: "Klinika Smile",
        lines: [
          {
            id: "l1",
            product: "P",
            symbol: null,
            subiektTwId: null,
            mikranCode: null,
            quantity: "1",
            quantityLabel: "1",
            progressLabel: null,
            stockStatus: "waiting",
            canAcknowledgePickup: false,
            clientName: "Klinika Smile",
            clientKhId: null,
          },
        ],
      }),
      row({
        id: "b",
        clientLabel: "Inny Klient",
        lines: [
          {
            id: "l2",
            product: "Q",
            symbol: null,
            subiektTwId: null,
            mikranCode: null,
            quantity: "1",
            quantityLabel: "1",
            progressLabel: null,
            stockStatus: "waiting",
            canAcknowledgePickup: false,
            clientName: "Inny",
            clientKhId: null,
          },
        ],
      }),
    ];
    expect(
      filterMyOrderRowsByClientLink(rows, { khId: 42, clientLabel: "Klinika Smile" }).map(
        (r) => r.id
      )
    ).toEqual(["a"]);
  });

  it("pokazuje prośbę po source_zk_watch_id mimo innej nazwy klienta", () => {
    const rows = [
      row({
        id: "linked",
        clientLabel: "Inna nazwa wpisana",
        sourceZkWatchId: "watch-1",
        sourceZkNumber: "ZK/2026/0142",
        lines: [
          {
            id: "l1",
            product: "P",
            symbol: null,
            subiektTwId: null,
            mikranCode: null,
            quantity: "1",
            quantityLabel: "1",
            progressLabel: null,
            stockStatus: "waiting",
            canAcknowledgePickup: false,
            clientName: "Inna nazwa wpisana",
            clientKhId: null,
          },
        ],
      }),
    ];
    expect(
      filterMyOrderRowsByClientLink(rows, {
        khId: 42,
        clientLabel: "Klinika Smile",
        zkWatchId: "watch-1",
        zkNumber: "ZK/2026/0142",
      }).map((r) => r.id)
    ).toEqual(["linked"]);
  });
});
