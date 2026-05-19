import { describe, expect, it } from "vitest";
import {
  aggregateOpenOrdersBySupplier,
  isOpenSalesSupplierOrder,
} from "./sales-open-orders";
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
});
