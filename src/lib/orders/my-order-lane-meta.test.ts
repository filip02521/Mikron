import { describe, expect, it } from "vitest";
import {
  classifyMyOrderProductLanes,
  displayProductLaneKind,
  resolveGroupAcknowledgeMode,
  resolveLinePickupAckMode,
  splitPickupPendingIds,
} from "@/lib/orders/my-order-lane-meta";
import type { IndividualOrder } from "@/types/database";

function order(partial: Partial<IndividualOrder> & { id: string }): IndividualOrder {
  return {
    sales_person_id: "sp1",
    supplier_id: "sup1",
    symbol: "A",
    products: "Produkt",
    quantity: "1",
    status: partial.status ?? "Zrealizowane",
    request_kind: "zamowienie",
    is_teeth: partial.is_teeth ?? false,
    sales_acknowledged_at: partial.sales_acknowledged_at ?? null,
    delivered_quantity: partial.delivered_quantity ?? "1",
    ...partial,
  } as IndividualOrder;
}

describe("my-order-lane-meta", () => {
  it("resolveLinePickupAckMode — zęby vs regał", () => {
    expect(
      resolveLinePickupAckMode(
        order({ id: "t", is_teeth: true, status: "Zrealizowane" })
      )
    ).toBe("teeth_handover");
    expect(
      resolveLinePickupAckMode(
        order({ id: "r", is_teeth: false, status: "Zrealizowane" })
      )
    ).toBe("pickup");
  });

  it("resolveGroupAcknowledgeMode — mixed_pickup", () => {
    expect(
      resolveGroupAcknowledgeMode([
        order({ id: "t", is_teeth: true, status: "Zrealizowane" }),
        order({ id: "r", is_teeth: false, status: "Zrealizowane" }),
      ])
    ).toBe("mixed_pickup");
  });

  it("splitPickupPendingIds — rozdziela zęby i regał", () => {
    const split = splitPickupPendingIds([
      order({ id: "t", is_teeth: true, status: "Zrealizowane" }),
      order({ id: "r", is_teeth: false, status: "Zrealizowane" }),
    ]);
    expect(split.teethIds).toEqual(["t"]);
    expect(split.shelfIds).toEqual(["r"]);
  });

  it("classifyMyOrderProductLanes — mixed", () => {
    expect(
      classifyMyOrderProductLanes([
        { isTeeth: true },
        { isTeeth: false },
      ]).laneKind
    ).toBe("mixed");
  });

  it("resolveGroupAcknowledgeMode — odbiór ma pierwszeństwo przed rezygnacją", () => {
    expect(
      resolveGroupAcknowledgeMode([
        order({
          id: "pick",
          is_teeth: false,
          status: "Zrealizowane",
        }),
        order({
          id: "cancel",
          status: "Zamowione",
          sales_cancelled_at: "2026-05-01T10:00:00.000Z",
          sales_cancel_phase: "in_transit",
        }),
      ])
    ).toBe("pickup");
  });

  it("displayProductLaneKind — mieszany tylko przy mixed_pickup", () => {
    expect(displayProductLaneKind("mixed", "mixed_pickup")).toBe("mixed");
    expect(displayProductLaneKind("mixed", "teeth_handover")).toBe("teeth");
    expect(displayProductLaneKind("mixed", "pickup")).toBe("regular");
  });
});
