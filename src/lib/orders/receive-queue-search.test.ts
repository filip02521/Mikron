import { describe, expect, it } from "vitest";
import type { IndividualOrder } from "@/types/database";
import {
  filterOrdersByProductSearch,
  filterReceiveQueueTable,
  orderMatchesProductSearch,
} from "./receive-queue-search";

function order(
  partial: Partial<IndividualOrder> & Pick<IndividualOrder, "id">
): IndividualOrder {
  return {
    supplier_id: "s1",
    sales_person_id: "p1",
    symbol: "IV-A",
    products: "Ivoclar T2",
    mikran_code: null,
    quantity: "1",
    delivered_quantity: "-",
    order_type: "Glowne",
    status: "Zamowione",
    action_at: "2026-01-01",
    delivery_at: null,
    ordered_at: null,
    request_kind: "zamowienie",
    ...partial,
  } as IndividualOrder;
}

describe("receive-queue-search", () => {
  const rows = [
    order({ id: "1", symbol: "IV-A", products: "Produkt A" }),
    order({ id: "2", symbol: "X-1", products: "Inny", mikran_code: "MIK-99" }),
    order({ id: "3", symbol: "-", products: "Bez symbolu", subiekt_tw_id: 100 }),
  ];

  it("dopasowuje po symbolu", () => {
    expect(orderMatchesProductSearch(rows[0]!, "iv-a")).toBe(true);
    expect(filterOrdersByProductSearch(rows, "IV-A").map((r) => r.id)).toEqual(["1"]);
  });

  it("dopasowuje po kodzie Mikron", () => {
    expect(filterOrdersByProductSearch(rows, "mik-99").map((r) => r.id)).toEqual(["2"]);
  });

  it("dopasowuje po subiekt_tw_id", () => {
    expect(filterOrdersByProductSearch(rows, "100").map((r) => r.id)).toEqual(["3"]);
  });

  it("łączy filtr towaru z dostawcą i ZD w pipeline", () => {
    const ivoclar = { id: "s1", name: "Ivoclar" } as never;
    const withSupplier = rows.map((r) => ({ ...r, supplier: ivoclar }));
    const result = filterReceiveQueueTable(withSupplier, {
      supplierFilter: "Ivoclar",
      zdProfile: null,
      productSearch: "IV-A",
    });
    expect(result.map((r) => r.id)).toEqual(["1"]);
  });
});
