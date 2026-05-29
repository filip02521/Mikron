import { describe, expect, it } from "vitest";
import { presentMyOrders } from "./my-order-presenter";
import type { IndividualOrder } from "@/types/database";

function informacjaOrder(
  extra: Partial<IndividualOrder> = {}
): IndividualOrder {
  return {
    id: "i1",
    supplier_id: "s1",
    sales_person_id: "sp1",
    symbol: "X",
    products: "Towar",
    quantity: "-",
    delivered_quantity: "-",
    order_type: "None",
    request_kind: "informacja",
    status: "Nowe",
    action_at: "2026-05-01",
    ordered_at: null,
    delivery_at: null,
    informacja_queue_via_daily_panel: false,
    supplier: { id: "s1", name: "Dostawca" } as IndividualOrder["supplier"],
    sales_person: { id: "sp1", name: "Jan" } as IndividualOrder["sales_person"],
    ...extra,
  };
}

describe("informacja status copy", () => {
  it("via panel przed Główne — czeka na zakupy", () => {
    const row = presentMyOrders(
      [informacjaOrder({ informacja_queue_via_daily_panel: true })],
      []
    ).informacje[0]!;
    expect(row.statusTitle).toBe("Czekamy na zamówienie u dostawcy");
  });

  it("via panel po Główne — czeka na magazyn", () => {
    const row = presentMyOrders(
      [
        informacjaOrder({
          informacja_queue_via_daily_panel: false,
          ordered_at: "2026-05-10T10:00:00Z",
        }),
      ],
      []
    ).informacje[0]!;
    expect(row.statusTitle).toBe("Zamówione — czekamy na magazyn");
  });

  it("bez panelu — tylko magazyn", () => {
    const row = presentMyOrders([informacjaOrder()], []).informacje[0]!;
    expect(row.statusTitle).toBe("Oczekuje na magazyn");
  });
});
