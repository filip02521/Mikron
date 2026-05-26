import { describe, expect, it } from "vitest";
import {
  buildSupplierGroupMetrics,
  formatSupplierGroupHeaderSummary,
} from "./supplier-group-metrics";
import type { IndividualOrder } from "@/types/database";

function order(
  partial: Partial<IndividualOrder> & { id: string }
): IndividualOrder {
  return {
    id: partial.id,
    supplier_id: "s1",
    sales_person_id: "sp1",
    symbol: "-",
    products: "P",
    quantity: "10",
    delivered_quantity: "2",
    order_type: "None",
    request_kind: "zamowienie",
    status: partial.status ?? "Zamowione",
    action_at: "",
    ordered_at: null,
    delivery_at: null,
    supplier: { name: "DFS" } as IndividualOrder["supplier"],
    ...partial,
  } as IndividualOrder;
}

describe("supplier group metrics", () => {
  it("łączy kolejkę i regał", () => {
    const m = buildSupplierGroupMetrics(
      [order({ id: "1", status: "Czesciowo_zrealizowane" }), order({ id: "2" })],
      [order({ id: "3", status: "Zrealizowane" })]
    );
    expect(m.get("DFS")).toEqual({ queue: 2, shelf: 1, partial: 1 });
  });

  it("formatuje podsumowanie z widocznej grupy", () => {
    const summary = formatSupplierGroupHeaderSummary(
      [
        order({ id: "1", status: "Czesciowo_zrealizowane" }),
        order({ id: "2" }),
      ],
      { queue: 4, shelf: 2, partial: 99 }
    );
    expect(summary).toContain("2 poz.");
    expect(summary).toContain("1 częściowo");
    expect(summary).toContain("na regale");
    expect(summary).not.toContain("99 częściowo");
  });
});
