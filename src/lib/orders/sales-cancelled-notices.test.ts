import { describe, expect, it } from "vitest";
import { buildSalesCancelledNotices } from "./sales-cancelled-notices";
import { testIndividualOrder } from "@/test-utils/fixtures";

function order(overrides: Parameters<typeof testIndividualOrder>[0]) {
  return testIndividualOrder({
    delivered_quantity: "0",
    order_type: "Glowne",
    status: "Anulowane",
    action_at: "2026-05-10T10:00:00Z",
    sales_cancelled_at: "2026-05-10T12:00:00Z",
    sales_cancel_phase: "before_order",
    ...overrides,
  });
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
    expect(notices[0].lines.every((l) => l.needsDisposition === false)).toBe(true);
  });

  it("oznacza pozycje w drodze jako wymagające decyzji", () => {
    const notices = buildSalesCancelledNotices(
      [
        order({ id: "z1", sales_cancel_phase: "in_transit", status: "Zamowione" }),
        order({ id: "z2", sales_cancel_phase: "before_order", status: "Anulowane" }),
      ],
      salesById
    );
    expect(notices).toHaveLength(1);
    expect(notices[0].needsDisposition).toBe(true);
    expect(notices[0].lines.find((l) => l.id === "z1")?.needsDisposition).toBe(true);
    expect(notices[0].lines.find((l) => l.id === "z2")?.needsDisposition).toBe(false);
  });
});
