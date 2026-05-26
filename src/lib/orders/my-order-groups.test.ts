import { describe, expect, it } from "vitest";
import { groupOrdersForMyView, myOrderGroupKey } from "./my-order-groups";
import type { IndividualOrder } from "@/types/database";

function order(partial: Partial<IndividualOrder> & Pick<IndividualOrder, "id">): IndividualOrder {
  return {
    supplier_id: "sup1",
    sales_person_id: "sp1",
    symbol: "-",
    products: "Produkt",
    quantity: "2",
    delivered_quantity: "-",
    order_type: "Glowne",
    request_kind: "zamowienie",
    status: "Zamowione",
    action_at: "2026-05-01T08:00:00Z",
    ordered_at: "2026-05-02T10:00:00Z",
    delivery_at: null,
    ...partial,
  } as IndividualOrder;
}

describe("myOrderGroupKey", () => {
  it("groups by submission_group_id for open orders", () => {
    const gid = "11111111-1111-1111-1111-111111111111";
    const a = order({
      id: "1",
      status: "Nowe",
      products: "A",
      ordered_at: null,
      submission_group_id: gid,
    });
    const b = order({
      id: "2",
      status: "Nowe",
      products: "B",
      ordered_at: null,
      submission_group_id: gid,
    });
    expect(myOrderGroupKey(a)).toBe(myOrderGroupKey(b));
  });

  it("groups ten lines in one open basket per supplier when legacy", () => {
    const a = order({
      id: "1",
      status: "Nowe",
      products: "A",
      ordered_at: null,
      action_at: "2026-05-01T08:00:00Z",
    });
    const b = order({
      id: "2",
      status: "Nowe",
      products: "B",
      ordered_at: null,
      action_at: "2026-05-03T14:00:00Z",
    });
    expect(myOrderGroupKey(a)).toBe(myOrderGroupKey(b));
  });

  it("groups by placement_group_id when ordered from panel", () => {
    const gid = "22222222-2222-2222-2222-222222222222";
    const a = order({ id: "1", placement_group_id: gid });
    const b = order({
      id: "2",
      products: "Inny",
      placement_group_id: gid,
    });
    expect(myOrderGroupKey(a)).toBe(myOrderGroupKey(b));
  });

  it("groups by exact ordered_at when placement_group missing", () => {
    const ts = "2026-05-02T10:00:00.000Z";
    const a = order({ id: "1", ordered_at: ts });
    const b = order({ id: "2", ordered_at: ts, products: "B" });
    expect(myOrderGroupKey(a)).toBe(myOrderGroupKey(b));
  });
});

describe("groupOrdersForMyView", () => {
  it("merges ten submission lines into one group", () => {
    const gid = "33333333-3333-3333-3333-333333333333";
    const rows = Array.from({ length: 10 }, (_, i) =>
      order({
        id: String(i + 1),
        status: "Nowe",
        ordered_at: null,
        products: `Produkt ${i + 1}`,
        submission_group_id: gid,
      })
    );
    const groups = groupOrdersForMyView(rows);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toHaveLength(10);
  });

  it("splits submission group when lines have mixed open statuses", () => {
    const gid = "44444444-4444-4444-4444-444444444444";
    const verification = order({
      id: "1",
      status: "Weryfikacja",
      ordered_at: null,
      submission_group_id: gid,
    });
    const nowe = order({
      id: "2",
      status: "Nowe",
      ordered_at: null,
      submission_group_id: gid,
    });
    expect(myOrderGroupKey(verification)).not.toBe(myOrderGroupKey(nowe));
    const groups = groupOrdersForMyView([verification, nowe]);
    expect(groups).toHaveLength(2);
  });
});
