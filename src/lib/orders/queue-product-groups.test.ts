import { describe, expect, it } from "vitest";
import {
  informacjaProductKey,
  orderIdsInProductGroup,
  sortInformacjaQueueByProduct,
} from "@/lib/orders/queue-product-groups";
import type { IndividualOrder } from "@/types/database";

function order(
  partial: Partial<IndividualOrder> & { id: string; sales_person_id: string }
): IndividualOrder {
  return {
    id: partial.id,
    supplier_id: partial.supplier_id ?? "s1",
    sales_person_id: partial.sales_person_id,
    symbol: partial.symbol ?? "SYM-1",
    products: partial.products ?? "Produkt A",
    quantity: "1",
    action_at: partial.action_at ?? "2026-01-01T10:00:00Z",
    sales_person: { name: partial.sales_person_id } as IndividualOrder["sales_person"],
    ...partial,
  } as IndividualOrder;
}

describe("queue-product-groups", () => {
  it("grupuje ten sam towar u różnych handlowców", () => {
    const list = [
      order({ id: "1", sales_person_id: "sp1" }),
      order({ id: "2", sales_person_id: "sp2" }),
      order({ id: "3", sales_person_id: "sp3", products: "Inny", symbol: "X" }),
    ];
    expect(orderIdsInProductGroup(list, 0)).toEqual(["1", "2"]);
    expect(informacjaProductKey(list[0]!)).toBe(informacjaProductKey(list[1]!));
    expect(informacjaProductKey(list[0]!)).not.toBe(informacjaProductKey(list[2]!));
  });

  it("sortInformacjaQueueByProduct — ten sam towar obok siebie", () => {
    const sorted = sortInformacjaQueueByProduct([
      order({ id: "b", sales_person_id: "sp2", action_at: "2026-01-02T10:00:00Z" }),
      order({ id: "a", sales_person_id: "sp1", action_at: "2026-01-01T10:00:00Z" }),
      order({ id: "c", sales_person_id: "sp3", products: "Inny", symbol: "Y" }),
    ]);
    expect(sorted.map((o) => o.id)).toEqual(["a", "b", "c"]);
  });
});
