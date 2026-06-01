import { describe, expect, it } from "vitest";
import {
  informacjaProductKey,
  orderIdsInProductGroup,
  sortInformacjaQueueByProduct,
} from "@/lib/orders/queue-product-groups";
import { testIndividualOrder } from "@/test-utils/fixtures";

function order(
  partial: Parameters<typeof testIndividualOrder>[0] & { sales_person_id: string }
) {
  return testIndividualOrder({
    symbol: "SYM-1",
    products: "Produkt A",
    sales_person: { name: partial.sales_person_id } as never,
    ...partial,
  });
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
