import { describe, expect, it } from "vitest";
import { summarizeQueueInbox } from "./queue-inbox";
import type { IndividualOrder } from "@/types/database";

function order(extra: Partial<IndividualOrder> = {}): IndividualOrder {
  return {
    id: "1",
    supplier_id: "s",
    sales_person_id: "sp",
    symbol: "A",
    products: "P",
    quantity: "1",
    delivered_quantity: "-",
    order_type: "Glowne",
    request_kind: "zamowienie",
    status: "Zamowione",
    action_at: "2026-05-01",
    ordered_at: "2026-05-01",
    delivery_at: null,
    ...extra,
  };
}

describe("queue-inbox", () => {
  it("summarizeQueueInbox rozdziela aktywne i rezygnacje z decyzją", () => {
    const s = summarizeQueueInbox([
      order({ id: "a" }),
      order({
        id: "c",
        sales_cancelled_at: "2026-05-10",
        sales_cancel_phase: "in_transit",
        procurement_cancel_disposition: "to_stock",
      }),
    ]);
    expect(s.activeCount).toBe(1);
    expect(s.zamowienieCount).toBe(1);
    expect(s.informacjaCount).toBe(0);
    expect(s.cancelLabelledCount).toBe(1);
  });

  it("liczy informacje w jednej kolejce z zamówieniami", () => {
    const s = summarizeQueueInbox(
      [order({ id: "z1" })],
      [order({ id: "i1", request_kind: "informacja", quantity: "-" })]
    );
    expect(s.activeCount).toBe(2);
    expect(s.informacjaCount).toBe(1);
  });

  it("wyklucza zęby z podsumowania zakładki Przyjęcie", () => {
    const s = summarizeQueueInbox([
      order({ id: "z1" }),
      order({ id: "t1", is_teeth: true }),
    ]);
    expect(s.activeCount).toBe(1);
    expect(s.zamowienieCount).toBe(1);
  });
});
