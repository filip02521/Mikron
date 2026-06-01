import { describe, expect, it } from "vitest";
import {
  informacjaWarehouseQueueActionLabel,
  isInformacjaWarehouseQueueOrder,
} from "./informacja-warehouse-queue";
import type { IndividualOrder } from "@/types/database";

function row(
  partial: Partial<IndividualOrder> & Pick<IndividualOrder, "status">
): IndividualOrder {
  return {
    id: "id",
    supplier_id: "s",
    sales_person_id: "p",
    symbol: "-",
    products: "x",
    quantity: "-",
    delivered_quantity: "-",
    order_type: "None",
    request_kind: "informacja",
    informacja_queue_via_daily_panel: false,
    action_at: "2026-01-01",
    delivery_at: null,
    ordered_at: null,
    ...partial,
  } as IndividualOrder;
}

describe("informacja-warehouse-queue", () => {
  it("pokazuje informację Nowe bez ścieżki przez panel", () => {
    expect(
      isInformacjaWarehouseQueueOrder(
        row({ status: "Nowe", informacja_queue_via_daily_panel: false })
      )
    ).toBe(true);
  });

  it("ukrywa informację Nowe czekającą na zamówienie w panelu Dziś", () => {
    expect(
      isInformacjaWarehouseQueueOrder(
        row({ status: "Nowe", informacja_queue_via_daily_panel: true })
      )
    ).toBe(false);
  });

  it("pokazuje informację Zamówione (oczekuje na dotarcie towaru)", () => {
    expect(
      isInformacjaWarehouseQueueOrder(
        row({ status: "Zamowione", informacja_queue_via_daily_panel: false })
      )
    ).toBe(true);
    expect(
      isInformacjaWarehouseQueueOrder(
        row({ status: "Zamowione", informacja_queue_via_daily_panel: true })
      )
    ).toBe(true);
  });

  it("nie pokazuje zrealizowanych", () => {
    expect(isInformacjaWarehouseQueueOrder(row({ status: "Zrealizowane" }))).toBe(
      false
    );
  });

  it("różnicuje etykietę akcji Nowe vs Zamówione", () => {
    expect(informacjaWarehouseQueueActionLabel("Nowe")).toContain("magazynie");
    expect(informacjaWarehouseQueueActionLabel("Zamowione")).toContain("Dotarło");
  });
});
