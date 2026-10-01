import { describe, expect, it } from "vitest";
import {
  groupOrdersBySupplier,
  orderIdsInSupplierGroup,
  queueSupplierLeadingCellClass,
  queueSupplierRowClass,
} from "@/lib/orders/queue-supplier-groups";
import { testIndividualOrder } from "@/test-utils/fixtures";

function order(partial: Parameters<typeof testIndividualOrder>[0]) {
  const supplierName =
    partial.supplier && "name" in partial.supplier ? partial.supplier.name : "Dostawca A";
  return testIndividualOrder({
    status: "Zamowione",
    action_at: "",
    supplier: { name: supplierName } as never,
    ...partial,
  });
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
