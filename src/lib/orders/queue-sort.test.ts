import { describe, expect, it } from "vitest";
import { sortIndividualOrdersBySupplier } from "./queue-sort";
import type { IndividualOrder } from "@/types/database";

function row(
  supplier: string,
  person: string,
  actionAt: string
): IndividualOrder {
  return {
    id: "1",
    supplier_id: "s",
    sales_person_id: "p",
    symbol: "-",
    products: "x",
    quantity: "1",
    delivered_quantity: "-",
    order_type: "Glowne",
    request_kind: "zamowienie",
    status: "Zamowione",
    action_at: actionAt,
    ordered_at: null,
    delivery_at: null,
    supplier: { id: "s", name: supplier } as never,
    sales_person: { id: "p", name: person } as never,
  };
}

describe("sortIndividualOrdersBySupplier", () => {
  it("sortuje po nazwie dostawcy", () => {
    const sorted = sortIndividualOrdersBySupplier([
      row("Zebra Sp.", "Anna", "2026-01-03"),
      row("Alfa", "Jan", "2026-01-01"),
      row("Beta", "Jan", "2026-01-02"),
    ]);
    expect(sorted.map((o) => o.supplier?.name)).toEqual(["Alfa", "Beta", "Zebra Sp."]);
  });
});
