import { describe, expect, it } from "vitest";
import type { MyOrderRow } from "./my-order-presenter";
import {
  myOrderProgressSection,
  MY_ORDER_PROGRESS_SECTION_COPY,
  MY_ORDER_PROGRESS_SECTION_EMPTY,
  partitionMyOrderProgressRows,
} from "./my-order-inbox-sections";

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
    timingLabel: null,
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
    headline: "Test",
    headlineTone: "info",
    subline: null,
    ...extra,
  };
}

describe("my-order-inbox-sections", () => {
  it("rozdziela przed zamówieniem od już zamówionych", () => {
    const before = row({ id: "b", statusTitle: "Przed zamówieniem" });
    const ordered = row({ id: "o", statusTitle: "Zamówione" });
    const partial = row({ id: "p", statusTitle: "Częściowo na magazynie" });
    const verify = row({ id: "v", statusTitle: "W dziale dostaw" });

    expect(myOrderProgressSection(before)).toBe("before_order");
    expect(myOrderProgressSection(verify)).toBe("before_order");
    expect(myOrderProgressSection(ordered)).toBe("ordered_progress");
    expect(myOrderProgressSection(partial)).toBe("ordered_progress");

    const { beforeOrder, orderedProgress } = partitionMyOrderProgressRows([
      ordered,
      before,
      partial,
      verify,
    ]);
    expect(beforeOrder.map((r) => r.id).sort()).toEqual(["b", "v"]);
    expect(orderedProgress.map((r) => r.id).sort()).toEqual(["o", "p"]);
  });

  it("sortuje w sekcjach według sortPriority (pilniejsze wyżej)", () => {
    const verify = row({
      id: "v",
      statusTitle: "W dziale dostaw",
      headlineTone: "info",
    });
    const przed = row({ id: "b", statusTitle: "Przed zamówieniem", headlineTone: "neutral" });
    const overdue = row({
      id: "o",
      statusTitle: "Zamówione",
      timingLabel: "x · po terminie",
      headlineTone: "warning",
    });
    const zam = row({ id: "z", statusTitle: "Zamówione", headlineTone: "info" });

    const { beforeOrder, orderedProgress } = partitionMyOrderProgressRows([
      przed,
      verify,
      zam,
      overdue,
    ]);
    expect(beforeOrder.map((r) => r.id)).toEqual(["v", "b"]);
    expect(orderedProgress.map((r) => r.id)).toEqual(["o", "z"]);
  });

  it("ma rozróżnialne ikony i akcenty sekcji postępu", () => {
    expect(MY_ORDER_PROGRESS_SECTION_COPY.ordered_progress.icon).toBe("zamowienie");
    expect(MY_ORDER_PROGRESS_SECTION_COPY.before_order.icon).toBe("before_order");
    expect(MY_ORDER_PROGRESS_SECTION_COPY.ordered_progress.accent).toBe("slate");
    expect(MY_ORDER_PROGRESS_SECTION_COPY.before_order.accent).toBe("indigo");
  });

  it("ma komunikaty pustego stanu sekcji postępu", () => {
    expect(MY_ORDER_PROGRESS_SECTION_EMPTY.ordered_progress).toContain("u dostawcy");
    expect(MY_ORDER_PROGRESS_SECTION_EMPTY.before_order).toContain("przed zamówieniem");
  });
});
