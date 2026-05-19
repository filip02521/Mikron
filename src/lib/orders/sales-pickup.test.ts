import { describe, expect, it } from "vitest";
import { isAwaitingSalesPickup } from "./sales-pickup";
import type { IndividualOrder } from "@/types/database";

function order(extra: Partial<IndividualOrder> = {}): IndividualOrder {
  return {
    id: "1",
    supplier_id: "s",
    sales_person_id: "sp",
    symbol: "A",
    products: "P",
    quantity: "2",
    delivered_quantity: "2",
    order_type: "Glowne",
    request_kind: "zamowienie",
    status: "Zrealizowane",
    action_at: "2026-05-01",
    ordered_at: "2026-05-01",
    delivery_at: null,
    ...extra,
  };
}

describe("sales-pickup", () => {
  it("gotowe do odbioru = Zrealizowane bez potwierdzenia handlowca", () => {
    expect(isAwaitingSalesPickup(order())).toBe(true);
    expect(isAwaitingSalesPickup(order({ sales_acknowledged_at: "2026-05-02" }))).toBe(
      false
    );
    expect(isAwaitingSalesPickup(order({ status: "Zamowione" }))).toBe(false);
    expect(isAwaitingSalesPickup(order({ sales_cancelled_at: "2026-05-02" }))).toBe(
      false
    );
    expect(isAwaitingSalesPickup(order({ request_kind: "informacja" }))).toBe(false);
  });
});
