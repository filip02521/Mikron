import { describe, expect, it } from "vitest";
import { sortWarehouseInventoryRows } from "./warehouse-inventory-sort";
import type { WarehouseInventoryRow } from "./warehouse-inventory";
import type { IndividualOrder } from "@/types/database";

function row(
  partial: Partial<IndividualOrder> & {
    shelf?: string;
    waitingDays?: number;
    products?: string;
  }
): WarehouseInventoryRow {
  const order = {
    id: partial.id ?? "1",
    supplier_id: "s1",
    sales_person_id: "sp1",
    symbol: "-",
    products: partial.products ?? "P",
    quantity: "1",
    delivered_quantity: "1",
    order_type: "None",
    request_kind: "zamowienie",
    status: "Zrealizowane",
    action_at: "",
    ordered_at: null,
    delivery_at: null,
    warehouse_shelf: partial.shelf ?? "Odbiór",
    supplier: { name: partial.supplier?.name ?? "Alpha" } as IndividualOrder["supplier"],
    sales_person: {
      name: partial.sales_person?.name ?? "Jan",
    } as IndividualOrder["sales_person"],
    ...partial,
  } as IndividualOrder;
  return {
    order,
    kind: "pickup_full",
    shelfLabel: partial.shelf ?? "Odbiór",
    waitingSince: null,
    waitingDays: partial.waitingDays ?? 0,
    waitingLevel: "ok",
    quantityOnShelf: "1",
    quantityLabel: "1 szt.",
  };
}

describe("sortWarehouseInventoryRows", () => {
  it("sortuje po dostawcy", () => {
    const sorted = sortWarehouseInventoryRows(
      [
        row({ id: "1", supplier: { name: "Zeta" } as never }),
        row({ id: "2", supplier: { name: "Alpha" } as never }),
      ],
      "supplier"
    );
    expect(sorted.map((r) => r.order.supplier?.name)).toEqual(["Alpha", "Zeta"]);
  });

  it("sortuje po handlowcu", () => {
    const sorted = sortWarehouseInventoryRows(
      [
        row({ id: "1", sales_person: { name: "Zosia" } as never }),
        row({ id: "2", sales_person: { name: "Adam" } as never }),
      ],
      "sales"
    );
    expect(sorted.map((r) => r.order.sales_person?.name)).toEqual(["Adam", "Zosia"]);
  });
});
