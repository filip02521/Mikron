import { describe, expect, it } from "vitest";
import {
  aggregateOpenOrdersBySupplier,
  aggregateVisibleMyOrdersBySupplier,
  isOpenSalesSupplierOrder,
} from "./sales-open-orders";
import { presentMyOrders } from "./my-order-presenter";
import type { IndividualOrder } from "@/types/database";

function order(extra: Partial<IndividualOrder> = {}): IndividualOrder {
  return {
    id: "1",
    supplier_id: "s1",
    sales_person_id: "sp",
    symbol: "A",
    products: "P",
    quantity: "1",
    delivered_quantity: "-",
    order_type: "Glowne",
    request_kind: "zamowienie",
    status: "Nowe",
    action_at: "2026-05-01",
    ordered_at: null,
    delivery_at: null,
    ...extra,
  };
}

describe("sales-open-orders", () => {
  it("nie liczy zamkniętych ani anulowanych", () => {
    expect(isOpenSalesSupplierOrder(order())).toBe(true);
    expect(isOpenSalesSupplierOrder(order({ sales_acknowledged_at: "2026-05-02" }))).toBe(
      false
    );
    expect(isOpenSalesSupplierOrder(order({ status: "Anulowane" }))).toBe(false);
    expect(isOpenSalesSupplierOrder(order({ supplier_id: null }))).toBe(false);
  });

  it("agreguje po dostawcy", () => {
    const r = aggregateOpenOrdersBySupplier([
      order({ id: "a" }),
      order({ id: "b", supplier_id: "s1" }),
      order({ id: "c", status: "Anulowane" }),
    ]);
    expect(r.prioritySupplierIds).toEqual(["s1"]);
    expect(r.openOrderCountBySupplier.s1).toBe(2);
  });

  it("aggregateVisibleMyOrdersBySupplier zgadza się z presentMyOrders", () => {
    const orders = [
      order({ id: "a", supplier_id: "s1" }),
      order({ id: "b", supplier_id: "s1", products: "B" }),
      order({ id: "c", status: "Anulowane", supplier_id: "s2" }),
      order({ id: "d", sales_acknowledged_at: "2026-05-02", supplier_id: "s3" }),
    ];
    const { zamowienia } = presentMyOrders(orders, []);
    const r = aggregateVisibleMyOrdersBySupplier(orders, []);
    expect(r.prioritySupplierIds).toEqual(["s1"]);
    expect(r.openOrderCountBySupplier.s1).toBe(zamowienia[0]?.lineCount ?? 0);
    expect(r.prioritySupplierIds).not.toContain("s2");
    expect(r.prioritySupplierIds).not.toContain("s3");
  });
});
