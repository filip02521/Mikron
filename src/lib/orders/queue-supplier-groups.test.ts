import { describe, expect, it } from "vitest";
import {
  groupOrdersBySupplier,
  orderIdsInSupplierGroup,
  queueSupplierLeadingCellClass,
  queueSupplierRowClass,
} from "@/lib/orders/queue-supplier-groups";
import type { IndividualOrder } from "@/types/database";

function order(partial: Partial<IndividualOrder> & { id: string }): IndividualOrder {
  return {
    id: partial.id,
    supplier_id: "s1",
    sales_person_id: "sp1",
    symbol: "-",
    products: "P",
    quantity: "1",
    delivered_quantity: "-",
    order_type: "None",
    request_kind: "zamowienie",
    status: "Zamowione",
    action_at: "",
    ordered_at: null,
    delivery_at: null,
    supplier: { name: partial.supplier?.name ?? "Dostawca A" } as IndividualOrder["supplier"],
    ...partial,
  } as IndividualOrder;
}

describe("queue supplier groups", () => {
  it("orderIdsInSupplierGroup", () => {
    const list = [
      order({ id: "1", supplier: { name: "A" } as never }),
      order({ id: "2", supplier: { name: "A" } as never }),
      order({ id: "3", supplier: { name: "B" } as never }),
    ];
    expect(orderIdsInSupplierGroup(list, 0)).toEqual(["1", "2"]);
    expect(orderIdsInSupplierGroup(list, 2)).toEqual(["3"]);
  });

  it("groupOrdersBySupplier", () => {
    const groups = groupOrdersBySupplier([
      order({ id: "1", supplier: { name: "A" } as never }),
      order({ id: "2", supplier: { name: "A" } as never }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.orders).toHaveLength(2);
  });

  it("pasek koloru jest na pierwszej komórce, nie na tr", () => {
    expect(queueSupplierRowClass(0)).not.toContain("border-l-");
    expect(queueSupplierLeadingCellClass(0)).toContain("border-l-");
    expect(queueSupplierLeadingCellClass(1, { variant: "informacja" })).toContain("border-l-sky");
  });
});
