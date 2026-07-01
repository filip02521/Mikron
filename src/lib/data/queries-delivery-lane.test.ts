import { describe, expect, it, vi } from "vitest";
import { filterDeliveryQueueByLane } from "@/lib/teeth/teeth-lifecycle";
import type { IndividualOrder } from "@/types/database";

vi.mock("@/lib/supabase/admin", () => ({
  hasSupabaseConfig: () => false,
  createAdminClient: () => ({}),
}));

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

describe("fetchIndividualHistory (lane filter helper)", () => {
  it("filterDeliveryQueueByLane rozdziela tory", () => {
    const rows = [order({ id: "t", is_teeth: true }), order({ id: "r" })];
    expect(filterDeliveryQueueByLane(rows, "teeth").map((o) => o.id)).toEqual(["t"]);
    expect(filterDeliveryQueueByLane(rows, "regular").map((o) => o.id)).toEqual(["r"]);
  });
});
