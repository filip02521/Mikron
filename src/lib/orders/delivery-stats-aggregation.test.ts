import { describe, expect, it } from "vitest";
import {
  aggregateDeliveryStatsFromOrders,
  businessDaysForDeliveryStatsSample,
  type DeliveryStatsOrderInput,
} from "@/lib/orders/delivery-stats-aggregation";

function order(
  partial: Partial<DeliveryStatsOrderInput> & Pick<DeliveryStatsOrderInput, "id">
): DeliveryStatsOrderInput {
  return {
    supplier_id: "sup-1",
    request_kind: "zamowienie",
    status: "Zrealizowane",
    ordered_at: "2026-03-10T10:00:00.000Z",
    action_at: "2026-03-10T10:00:00.000Z",
    delivery_at: "2026-03-11T08:00:00.000Z",
    order_type: "Glowne",
    products: "Produkt X",
    is_teeth: false,
    sales_cancelled_at: null,
    procurement_cancel_disposition: null,
    ...partial,
  };
}

describe("aggregateDeliveryStatsFromOrders", () => {
  it("liczy dni robocze po dacie kalendarzowej Warszawy (nie UTC startOfDay)", () => {
    // 2026-03-10 23:30 Warsaw = 2026-03-10 22:30 UTC → ten sam dzień PL
    // delivery next morning Warsaw
    const { samples } = aggregateDeliveryStatsFromOrders([
      order({
        id: "a",
        ordered_at: "2026-03-10T22:30:00.000Z",
        delivery_at: "2026-03-11T07:00:00.000Z",
      }),
    ]);
    expect(samples).toHaveLength(1);
    expect(samples[0]!.businessDays).toBe(1);
    expect(samples[0]!.placementDate).toBe("2026-03-10");
    expect(samples[0]!.deliveryDate).toBe("2026-03-11");
  });

  it("pomija is_teeth i cancel-disposition", () => {
    const { samples, skipped } = aggregateDeliveryStatsFromOrders([
      order({ id: "teeth", is_teeth: true }),
      order({
        id: "cancel",
        sales_cancelled_at: "2026-03-10T12:00:00.000Z",
        procurement_cancel_disposition: "to_stock",
      }),
      order({ id: "ok", delivery_at: "2026-03-12T10:00:00.000Z" }),
    ]);
    expect(samples.map((s) => s.orderId)).toEqual(["ok"]);
    expect(skipped.some((s) => s.reason === "zęby")).toBe(true);
    expect(skipped.some((s) => s.reason === "cancel-disposition")).toBe(true);
  });

  it("same-day → 0 dni roboczych (próbka OK)", () => {
    const days = businessDaysForDeliveryStatsSample(
      order({
        id: "same",
        ordered_at: "2026-03-10T08:00:00.000Z",
        delivery_at: "2026-03-10T16:00:00.000Z",
      }),
      "2026-03-10T16:00:00.000Z"
    );
    expect(days).toBe(0);
  });
});
