import { describe, expect, it } from "vitest";
import { filterMyOrderRows, rowMatchesInboxFilter } from "./my-order-inbox-filter";
import type { MyOrderRow } from "./my-order-presenter";

function row(partial: Partial<MyOrderRow> & Pick<MyOrderRow, "id">): MyOrderRow {
  return {
    id: partial.id,
    lineCount: 1,
    lines: [],
    kind: "zamowienie",
    submittedLabel: "01.05.2026",
    supplierName: "Dostawca",
    product: "Produkt",
    symbol: null,
    statusTitle: "Zamówione",
    statusDetail: null,
    timingLabel: null,
    quantityLabel: "1 szt.",
    progressLabel: null,
    badgeVariant: "info",
    rowColor: "#fff",
    headline: "Zamówione",
    headlineTone: "info",
    subline: null,
    sortPriority: 7,
    acknowledgeMode: "none",
    orderIds: [partial.id],
    pickupPendingCount: 0,
    pickupPendingIds: [],
    pickupReadyTotal: 0,
    pickupAcknowledgedCount: 0,
    ...partial,
  };
}

describe("my-order-inbox-filter", () => {
  it("filtruje po statusie przed zamówieniem", () => {
    const rows = [
      row({ id: "a", statusTitle: "Przed zamówieniem", badgeVariant: "purple" }),
      row({ id: "b", statusTitle: "Zamówione" }),
    ];
    const filtered = filterMyOrderRows(rows, "przed_zamowieniem");
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe("a");
  });

  it("oznacza odbiór jako pickup", () => {
    const pickup = row({
      id: "p",
      statusTitle: "Do odbioru",
      acknowledgeMode: "pickup",
      pickupPendingCount: 1,
      sortPriority: 1,
      headlineTone: "action",
    });
    expect(rowMatchesInboxFilter(pickup, "pickup")).toBe(true);
    expect(rowMatchesInboxFilter(pickup, "zamowione")).toBe(false);
  });
});
