import { describe, expect, it } from "vitest";
import {
  canAcknowledgeWarehouseCancelDisposition,
  isCancelledDispositionInReceiveQueue,
  needsReceiveBeforeWarehouseCancelAck,
  warehouseCancelFulfillButtonLabel,
} from "./warehouse-cancel-fulfillment";
import type { IndividualOrder } from "@/types/database";

function order(
  status: IndividualOrder["status"],
  extra: Partial<IndividualOrder> = {}
): IndividualOrder {
  return {
    id: "1",
    supplier_id: "s",
    sales_person_id: "sp",
    symbol: "A",
    products: "Produkt",
    quantity: "5",
    delivered_quantity: "-",
    order_type: "Glowne",
    request_kind: "zamowienie",
    status,
    action_at: "2026-05-01",
    ordered_at: null,
    delivery_at: null,
    ...extra,
  };
}

describe("warehouse-cancel-fulfillment", () => {
  const cancelledBase = {
    sales_cancelled_at: "2026-05-10T08:00:00Z",
    sales_cancel_phase: "on_stock" as const,
    procurement_cancel_disposition: "return",
  };

  it("isCancelledDispositionInReceiveQueue gdy jest decyzja zakupów", () => {
    expect(
      isCancelledDispositionInReceiveQueue(
        order("Zrealizowane", {
          ...cancelledBase,
          delivered_quantity: "5",
        })
      )
    ).toBe(true);
    expect(
      isCancelledDispositionInReceiveQueue(
        order("Zrealizowane", {
          ...cancelledBase,
          warehouse_cancel_fulfilled_at: "2026-05-11T08:00:00Z",
        })
      )
    ).toBe(false);
  });

  it("needsReceiveBeforeWarehouseCancelAck tylko dla in_transit bez przyjęcia", () => {
    expect(
      needsReceiveBeforeWarehouseCancelAck(
        order("Zamowione", {
          ...cancelledBase,
          sales_cancel_phase: "in_transit",
          procurement_cancel_disposition: "to_stock",
        })
      )
    ).toBe(true);
    expect(
      needsReceiveBeforeWarehouseCancelAck(
        order("Zrealizowane", {
          ...cancelledBase,
          delivered_quantity: "5",
        })
      )
    ).toBe(false);
  });

  it("canAcknowledgeWarehouseCancelDisposition dla on_stock od razu", () => {
    expect(
      canAcknowledgeWarehouseCancelDisposition(
        order("Zrealizowane", {
          ...cancelledBase,
          delivered_quantity: "5",
        })
      )
    ).toBe(true);
  });

  it("warehouseCancelFulfillButtonLabel zależy od decyzji i fazy", () => {
    expect(
      warehouseCancelFulfillButtonLabel(
        order("Zrealizowane", { ...cancelledBase, delivered_quantity: "5" })
      )
    ).toBe("Zdjęto z regału");
    expect(
      warehouseCancelFulfillButtonLabel(
        order("Zamowione", {
          ...cancelledBase,
          sales_cancel_phase: "in_transit",
          procurement_cancel_disposition: "to_stock",
        })
      )
    ).toBe("Przyjęto na stan");
  });
});
