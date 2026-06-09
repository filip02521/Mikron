import { describe, expect, it } from "vitest";
import type { MyOrderRow } from "./my-order-presenter";
import {
  deriveMyOrderRequestProgress,
  shouldShowMyOrderRequestProgress,
} from "./my-order-request-progress";
import {
  INFORMACJA_FLOW_SALES_AWAITING_PROCUREMENT,
  INFORMACJA_FLOW_SALES_AWAITING_WAREHOUSE,
  INFORMACJA_FLOW_SALES_DIRECT,
  INFORMACJA_FLOW_SALES_STOCK_OUT,
  INFORMACJA_FLOW_SALES_STOCK_OUT_ORDERED,
} from "./informacja-flow-copy";

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
    headline: "Zamówione — czekamy na dostawę",
    headlineTone: "info",
    subline: null,
    ...extra,
  };
}

describe("my-order-request-progress", () => {
  it("zamówienie — kroki Prośba → Zamówienie → Dostawa → Odbiór", () => {
    const track = deriveMyOrderRequestProgress(row({ statusTitle: "Przed zamówieniem" }));
    expect(track?.steps.map((s) => s.label)).toEqual([
      "Prośba",
      "Zamówienie",
      "Dostawa",
      "Odbiór",
    ]);
    expect(track?.steps.find((s) => s.id === "request")?.state).toBe("current");
  });

  it("zamówienie — aktualny krok Zamówienie", () => {
    const track = deriveMyOrderRequestProgress(row({ statusTitle: "Zamówione" }));
    expect(track?.steps.find((s) => s.id === "order")?.state).toBe("current");
    expect(track?.steps.find((s) => s.id === "request")?.state).toBe("done");
  });

  it("zamówienie — częściowa dostawa na kroku Dostawa", () => {
    const track = deriveMyOrderRequestProgress(
      row({ statusTitle: "Częściowo na magazynie", headlineTone: "stock" })
    );
    expect(track?.steps.find((s) => s.id === "delivery")?.state).toBe("current");
  });

  it("zamówienie — odbiór jako ostatni krok", () => {
    const track = deriveMyOrderRequestProgress(
      row({
        statusTitle: "Do odbioru",
        acknowledgeMode: "pickup",
        pickupPendingCount: 1,
        headlineTone: "action",
      })
    );
    expect(track?.steps.find((s) => s.id === "pickup")?.state).toBe("current");
  });

  it("informacja — ścieżka bezpośrednia", () => {
    const track = deriveMyOrderRequestProgress(
      row({
        kind: "informacja",
        requestKind: "informacja",
        statusTitle: INFORMACJA_FLOW_SALES_DIRECT.statusTitle,
      })
    );
    expect(track?.accent).toBe("informacja");
    expect(track?.steps.find((s) => s.id === "warehouse")?.state).toBe("current");
  });

  it("informacja — czeka na zamówienie u dostawcy", () => {
    const track = deriveMyOrderRequestProgress(
      row({
        kind: "informacja",
        requestKind: "informacja",
        statusTitle: INFORMACJA_FLOW_SALES_AWAITING_PROCUREMENT.statusTitle,
      })
    );
    expect(track?.steps.find((s) => s.id === "order")?.state).toBe("current");
  });

  it("informacja — czeka na magazyn po zamówieniu", () => {
    const track = deriveMyOrderRequestProgress(
      row({
        kind: "informacja",
        requestKind: "informacja",
        statusTitle: INFORMACJA_FLOW_SALES_AWAITING_WAREHOUSE.statusTitle,
      })
    );
    expect(track?.steps.find((s) => s.id === "warehouse")?.state).toBe("current");
  });

  it("informacja — brak na stanie", () => {
    const track = deriveMyOrderRequestProgress(
      row({
        kind: "informacja",
        requestKind: "informacja",
        statusTitle: INFORMACJA_FLOW_SALES_STOCK_OUT.statusTitle,
      })
    );
    expect(track?.steps).toHaveLength(2);
    expect(track?.steps[0]?.state).toBe("current");
  });

  it("informacja — brak na stanie, już zamówione", () => {
    const track = deriveMyOrderRequestProgress(
      row({
        kind: "informacja",
        requestKind: "informacja",
        statusTitle: INFORMACJA_FLOW_SALES_STOCK_OUT_ORDERED.statusTitle,
      })
    );
    expect(track?.steps[1]?.state).toBe("current");
  });

  it("ukrywa pasek przy anulowaniu do potwierdzenia", () => {
    expect(
      shouldShowMyOrderRequestProgress(
        row({ acknowledgeMode: "cancelled", cancelledAckOrderIds: ["x"] })
      )
    ).toBe(false);
  });
});
