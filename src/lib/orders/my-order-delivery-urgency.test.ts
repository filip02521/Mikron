import { describe, expect, it } from "vitest";
import type { MyOrderRow } from "./my-order-presenter";
import { presentMyOrders } from "./my-order-presenter";
import type { IndividualOrder } from "@/types/database";
import { formatDateString } from "./dates";
import {
  classifyDeliveryUrgency,
  deliveryUrgencyShowsBadge,
  deliveryUrgencyRowVisual,
  resolveMyOrderDeliveryRowVisual,
  resolveMyOrderPartialStockRowVisual,
  resolveMyOrderExpectedDeliveryDate,
  sortOrderedProgressByDelivery,
} from "./my-order-delivery-urgency";

const at = new Date("2026-06-18T12:00:00+02:00");

const partialOrder: IndividualOrder = {
  id: "p1",
  supplier_id: "sup1",
  sales_person_id: "sp1",
  symbol: "ABC",
  products: "Wkręt",
  quantity: "3",
  delivered_quantity: "2",
  order_type: "Glowne",
  request_kind: "zamowienie",
  status: "Czesciowo_zrealizowane",
  action_at: "2026-04-28",
  ordered_at: "2026-05-01",
  delivery_at: null,
  supplier: {
    id: "sup1",
    name: "Dostawca X",
    location: "POLSKA",
    pickup_mikran: false,
    pickup_pallet: false,
    notes: "",
    mails: "",
    extra_info: "",
    interval_raw: null,
    interval_weeks: null,
    stock_raw: null,
    stock: null,
    stats_mode: "LACZNIE",
    order_on_demand: false,
    is_active: true,
  },
};

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
    quantityLabel: "1 szt.",
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
    headline: "Zamówione",
    headlineTone: "info",
    subline: null,
    ...extra,
  };
}

describe("resolveMyOrderExpectedDeliveryDate", () => {
  it("bierze datę z ZD", () => {
    const d = resolveMyOrderExpectedDeliveryDate(
      row({
        zdFulfillment: {
          deadline: "2026-07-15",
          dokNr: "ZD/1",
          syncedAt: null,
          source: "zd",
        },
        timingLabel: "ok. 01.01.2026",
      })
    );
    expect(d && formatDateString(d)).toBe("2026-07-15");
  });

  it("parsuje datę z timingLabel", () => {
    const d = resolveMyOrderExpectedDeliveryDate(
      row({ timingLabel: "ok. 22.06.2026 (~5 dni rob.)" })
    );
    expect(d && formatDateString(d)).toBe("2026-06-22");
  });
});

describe("classifyDeliveryUrgency", () => {
  it("rozpoznaje jutro i ten tydzień", () => {
    expect(
      classifyDeliveryUrgency(new Date("2026-06-19T12:00:00+02:00"), { at }).shortLabel
    ).toBe("Jutro");
    expect(
      classifyDeliveryUrgency(new Date("2026-06-20T12:00:00+02:00"), { at }).shortLabel
    ).toBe("Ten tydzień");
  });

  it("rozpoznaje po terminie", () => {
    expect(
      classifyDeliveryUrgency(new Date("2026-06-10T12:00:00+02:00"), { at }).urgency
    ).toBe("overdue");
  });
});

describe("sortOrderedProgressByDelivery", () => {
  it("sortuje od najbliższego terminu u góry", () => {
    const far = row({
      id: "far",
      zdFulfillment: {
        deadline: "2026-07-15",
        dokNr: "ZD/1",
        syncedAt: null,
        source: "zd",
      },
      timingLabel: "do 15.07.2026 · ZD/1",
    });
    const near = row({
      id: "near",
      timingLabel: "ok. 22.06.2026 (~5 dni rob.)",
    });
    const mid = row({
      id: "mid",
      timingLabel: "ok. 03.07.2026 (~5 dni rob.)",
    });
    const sorted = sortOrderedProgressByDelivery([near, far, mid], at);
    expect(sorted.map((r) => r.id)).toEqual(["near", "mid", "far"]);
  });
});

describe("deliveryUrgencyRowVisual", () => {
  it("zwraca akcent tylko dla po terminie i dziś", () => {
    expect(deliveryUrgencyRowVisual("tomorrow")).toBeNull();
    expect(deliveryUrgencyRowVisual("overdue")?.borderAccent).toContain("amber");
    expect(deliveryUrgencyRowVisual("today")?.borderAccent).toContain("indigo");
    expect(deliveryUrgencyRowVisual("later")).toBeNull();
  });

  it("nie akcentuje wierszy przed zamówieniem", () => {
    expect(
      resolveMyOrderDeliveryRowVisual(
        row({ statusTitle: "Przed zamówieniem", timingLabel: "ok. 19.06.2026" }),
        at
      )
    ).toBeNull();
  });

  it("akcentuje częściową dostawę na niebiesko", () => {
    const partial = presentMyOrders([partialOrder], []).zamowienia[0]!;
    const visual = resolveMyOrderDeliveryRowVisual(partial, at);
    expect(visual?.borderAccent).toContain("sky");
    expect(visual?.collapsedBg).toContain("sky");
    expect(resolveMyOrderPartialStockRowVisual(partial)?.borderAccent).toContain("sky");
  });
});

describe("deliveryUrgencyShowsBadge", () => {
  it("pokazuje badge tylko dla po terminie i dziś", () => {
    expect(deliveryUrgencyShowsBadge("overdue")).toBe(true);
    expect(deliveryUrgencyShowsBadge("today")).toBe(true);
    expect(deliveryUrgencyShowsBadge("tomorrow")).toBe(false);
    expect(deliveryUrgencyShowsBadge("this_week")).toBe(false);
  });
});
