import { describe, expect, it } from "vitest";
import {
  countDeliveryQueueCancelledRows,
  countInformacjaWarehouseQueueRows,
} from "./queue-counts";
import type { IndividualOrder } from "@/types/database";

function informacjaRow(
  partial: Partial<IndividualOrder> & Pick<IndividualOrder, "status">
) {
  return {
    request_kind: "informacja" as const,
    informacja_queue_via_daily_panel: false,
    sales_cancelled_at: null,
    ...partial,
  };
}

function zamowienieCancelled(
  partial: Partial<IndividualOrder> = {}
): IndividualOrder {
  return {
    id: "1",
    supplier_id: "s",
    sales_person_id: "p",
    symbol: "A",
    products: "x",
    quantity: "1",
    delivered_quantity: "0",
    order_type: "None",
    request_kind: "zamowienie",
    status: "Zamowione",
    action_at: "2026-01-01",
    delivery_at: null,
    ordered_at: null,
    sales_cancelled_at: "2026-02-01",
    sales_cancel_phase: "in_transit",
    procurement_cancel_disposition: "to_stock",
    ...partial,
  } as IndividualOrder;
}

describe("countInformacjaWarehouseQueueRows", () => {
  it("liczy jak isInformacjaWarehouseQueueOrder", () => {
    const rows = [
      informacjaRow({ status: "Nowe", informacja_queue_via_daily_panel: false }),
      informacjaRow({ status: "Nowe", informacja_queue_via_daily_panel: true }),
      informacjaRow({ status: "Zamowione" }),
    ];
    expect(countInformacjaWarehouseQueueRows(rows)).toBe(2);
  });
});

describe("countDeliveryQueueCancelledRows", () => {
  it("liczy tylko in_transit/on_stock z decyzją zakupów", () => {
    expect(
      countDeliveryQueueCancelledRows([
        zamowienieCancelled({
          sales_cancel_phase: "in_transit",
          procurement_cancel_disposition: "to_stock",
        }),
        zamowienieCancelled({
          sales_cancel_phase: "before_order",
          procurement_cancel_disposition: "to_stock",
        }),
        zamowienieCancelled({
          sales_cancel_phase: "in_transit",
          procurement_cancel_disposition: null,
        }),
      ])
    ).toBe(1);
  });
});
