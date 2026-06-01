import { describe, expect, it } from "vitest";
import { normalizeIndividualOrder } from "./normalize-order";

describe("normalizeIndividualOrder", () => {
  it("mapuje embed suppliers → supplier", () => {
    const row = normalizeIndividualOrder({
      id: "1",
      supplier_id: "s1",
      sales_person_id: "p1",
      products: "X",
      symbol: "-",
      quantity: "1",
      status: "Nowe",
      order_type: "None",
      delivered_quantity: "-",
      request_kind: "zamowienie",
      action_at: "2026-01-01",
      ordered_at: null,
      delivery_at: null,
      suppliers: { id: "s1", name: "Dentaurum" } as never,
    });
    expect(row.supplier?.name).toBe("Dentaurum");
  });

  it("mapuje embed sales_people → sales_person", () => {
    const row = normalizeIndividualOrder({
      id: "1",
      supplier_id: "s1",
      sales_person_id: "p1",
      products: "X",
      symbol: "-",
      quantity: "1",
      status: "Nowe",
      order_type: "None",
      delivered_quantity: "-",
      request_kind: "zamowienie",
      action_at: "2026-01-01",
      ordered_at: null,
      delivery_at: null,
      sales_people: { id: "p1", name: "Jan Kowalski" } as never,
    });
    expect(row.sales_person?.name).toBe("Jan Kowalski");
  });
});
