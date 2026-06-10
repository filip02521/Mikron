import { describe, expect, it } from "vitest";
import { presentMyOrders } from "@/lib/orders/my-order-presenter";
import type { DeliveryStats, IndividualOrder } from "@/types/database";

function order(
  id: string,
  status: IndividualOrder["status"],
  extra: Partial<IndividualOrder> = {}
): IndividualOrder {
  return {
    id,
    supplier_id: "supplier-ivoclar",
    sales_person_id: "sp-1",
    symbol: `SYM-${id}`,
    products: `Product ${id}`,
    quantity: "1",
    delivered_quantity: "-",
    order_type: "Glowne",
    request_kind: "zamowienie",
    status,
    action_at: "2026-05-01",
    ordered_at: null,
    delivery_at: null,
    ...extra,
  };
}

describe("my-order line cancel flags", () => {
  it("oznacza anulowalność per linia w grupie dostawcy", () => {
    const orders = [
      order("line-a", "Zamowione"),
      order("line-b", "Zamowione"),
    ];
    const stats: DeliveryStats[] = [];
    const { zamowienia } = presentMyOrders(orders, stats);
    expect(zamowienia).toHaveLength(1);
    const row = zamowienia[0]!;
    expect(row.lineCount).toBe(2);
    expect(row.lines[0]?.canCancelBySales).toBe(true);
    expect(row.lines[0]?.salesCancelPhase).toBe("in_transit");
    expect(row.lines[1]?.canCancelBySales).toBe(true);
    expect(row.lines[1]?.salesCancelPhase).toBe("in_transit");
    expect(row.salesCancelOrderIds).toEqual(["line-a", "line-b"]);
  });
});
