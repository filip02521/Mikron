import { describe, expect, it } from "vitest";
import { buildSalesCancelledNotices } from "./sales-cancelled-notices";
import type { IndividualOrder } from "@/types/database";

function order(
  overrides: Partial<IndividualOrder> & Pick<IndividualOrder, "id">
): IndividualOrder {
  return {
    id: overrides.id,
    supplier_id: "s1",
    sales_person_id: "sp1",
    symbol: "SYM",
    products: "Produkt",
    quantity: "1",
    delivered_quantity: "0",
    order_type: "GLOWNE",
    request_kind: "zamowienie",
    status: "Anulowane",
    action_at: "2026-05-10T10:00:00Z",
    ordered_at: null,
    delivery_at: null,
    sales_cancelled_at: "2026-05-10T12:00:00Z",
    sales_cancel_phase: "before_order",
    ...overrides,
  };
}

describe("buildSalesCancelledNotices", () => {
  const salesById = new Map([["sp1", "Jan Kowalski"]]);

  it("pomija anulowane prośby o informację (dostępność)", () => {
    const notices = buildSalesCancelledNotices(
      [
        order({
          id: "info-1",
          request_kind: "informacja",
          status: "Anulowane",
        }),
      ],
      salesById
    );
    expect(notices).toHaveLength(0);
  });

  it("pokazuje zamówienia dla klientów we wszystkich fazach rezygnacji", () => {
    const notices = buildSalesCancelledNotices(
      [
        order({ id: "z1", sales_cancel_phase: "before_order", status: "Anulowane" }),
        order({
          id: "z2",
          sales_person_id: "sp2",
          sales_cancel_phase: "in_transit",
          status: "Zamowione",
        }),
        order({
          id: "z3",
          sales_cancel_phase: "on_stock",
          status: "Zrealizowane",
          sales_person_id: "sp2",
        }),
      ],
      salesById
    );
    expect(notices).toHaveLength(2);
    expect(notices[0].orderIds).toEqual(["z1"]);
    expect(notices[0].phase).toBe("before_order");
    expect(notices.find((n) => n.orderIds.includes("z3"))?.phase).toBe("on_stock");
  });

  it("ukrywa pozycje potwierdzone przez zakupy", () => {
    const notices = buildSalesCancelledNotices(
      [
        order({
          id: "z1",
          procurement_sales_cancel_ack_at: "2026-05-11T08:00:00Z",
        }),
        order({ id: "z2", sales_person_id: "sp2" }),
      ],
      salesById
    );
    expect(notices).toHaveLength(1);
    expect(notices[0].orderIds).toEqual(["z2"]);
  });

  it("grupuje po dostawcy i handlowcu z etykietą klienta", () => {
    const notices = buildSalesCancelledNotices(
      [
        order({ id: "z1", sales_client_name: "  Firma ABC  " }),
        order({ id: "z2" }),
      ],
      salesById
    );
    expect(notices).toHaveLength(1);
    expect(notices[0].clientName).toBe("Firma ABC");
    expect(notices[0].lines).toHaveLength(2);
  });
});
