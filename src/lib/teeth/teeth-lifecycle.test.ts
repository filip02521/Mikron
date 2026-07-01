import { describe, expect, it } from "vitest";
import {
  filterDeliveryQueueByLane,
  isTeethOrder,
  isTeethZamowienie,
  partitionOrdersByProcurementLane,
  procurementLane,
  teethProcurementDeliveryEta,
  teethProcurementOrderedAt,
} from "./teeth-lifecycle";
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
    status: "Nowe",
    action_at: "2026-05-01",
    ordered_at: null,
    delivery_at: null,
    ...extra,
  };
}

describe("teeth-lifecycle", () => {
  it("rozpoznaje zamówienie zębowe vs informację", () => {
    expect(isTeethOrder(order({ is_teeth: true }))).toBe(true);
    expect(isTeethZamowienie(order({ is_teeth: true }))).toBe(true);
    expect(
      isTeethZamowienie(
        order({ is_teeth: true, request_kind: "informacja", quantity: "-" })
      )
    ).toBe(false);
    expect(procurementLane(order({ is_teeth: true }))).toBe("teeth");
    expect(procurementLane(order())).toBe("regular");
  });

  it("dzieli listy po torze zakupów", () => {
    const teeth = order({ id: "t", is_teeth: true });
    const regular = order({ id: "r" });
    const { regular: r, teeth: t } = partitionOrdersByProcurementLane([teeth, regular]);
    expect(r.map((o) => o.id)).toEqual(["r"]);
    expect(t.map((o) => o.id)).toEqual(["t"]);
  });

  it("filtruje kolejkę dostaw po torze", () => {
    const rows = [
      order({ id: "t", is_teeth: true }),
      order({ id: "r" }),
    ];
    expect(filterDeliveryQueueByLane(rows, "teeth").map((o) => o.id)).toEqual(["t"]);
    expect(filterDeliveryQueueByLane(rows, "regular").map((o) => o.id)).toEqual(["r"]);
    expect(filterDeliveryQueueByLane(rows, "all")).toHaveLength(2);
  });

  it("preferuje teeth_ordered_at nad ordered_at", () => {
    expect(
      teethProcurementOrderedAt({
        teeth_ordered_at: "2026-06-01T10:00:00Z",
        ordered_at: "2026-05-01T10:00:00Z",
      })
    ).toBe("2026-06-01T10:00:00Z");
    expect(
      teethProcurementOrderedAt({
        teeth_ordered_at: null,
        ordered_at: "2026-05-01T10:00:00Z",
      })
    ).toBe("2026-05-01T10:00:00Z");
  });

  it("czyta teeth_delivery_date", () => {
    expect(teethProcurementDeliveryEta({ teeth_delivery_date: "2026-06-15" })).toBe(
      "2026-06-15"
    );
    expect(teethProcurementDeliveryEta({ teeth_delivery_date: null })).toBeNull();
  });
});
