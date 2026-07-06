import { describe, expect, it } from "vitest";
import { filterMyOrderRowsByClientLink } from "./moje-client-link-filter";
import type { MyOrderRow } from "@/lib/orders/my-order-presenter";
import { createTestMyOrderLine, createTestMyOrderRow } from "./test-fixtures";

function row(partial: Partial<MyOrderRow> & { lines: MyOrderRow["lines"] }): MyOrderRow {
  return createTestMyOrderRow({ ...partial, lineCount: partial.lines.length });
}

describe("filterMyOrderRowsByClientLink", () => {
  it("dopasowuje po kh na pozycji", () => {
    const rows = [
      row({
        id: "a",
        lines: [
          createTestMyOrderLine({
            id: "l1",
            product: "P",
            clientName: "Inna",
            clientKhId: 42,
          }),
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
          createTestMyOrderLine({
            id: "l1",
            product: "P",
            clientName: "Klinika Smile",
            clientKhId: null,
          }),
        ],
      }),
      row({
        id: "b",
        clientLabel: "Inny Klient",
        lines: [
          createTestMyOrderLine({
            id: "l2",
            product: "Q",
            clientName: "Inny",
            clientKhId: null,
          }),
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
          createTestMyOrderLine({
            id: "l1",
            product: "P",
            clientName: "Inna nazwa wpisana",
            clientKhId: null,
          }),
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
