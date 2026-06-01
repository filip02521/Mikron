import { describe, expect, it } from "vitest";
import { supplierKey } from "@/lib/orders/queue-supplier-groups";
import {
  groupReceiveQueueBySupplier,
  mergeReceiveQueueOrders,
  partitionReceiveSelection,
  sortSupplierReceiveOrders,
} from "./receive-queue";
import type { IndividualOrder } from "@/types/database";

function row(
  partial: Partial<IndividualOrder> & Pick<IndividualOrder, "id" | "request_kind">
): IndividualOrder {
  return {
    supplier_id: "s1",
    sales_person_id: "p1",
    symbol: "A",
    products: "Produkt A",
    quantity: "2",
    delivered_quantity: "-",
    order_type: "Glowne",
    status: "Zamowione",
    action_at: "2026-01-01",
    delivery_at: null,
    ordered_at: null,
    ...partial,
  } as IndividualOrder;
}

describe("receive-queue", () => {
  it("sortuje zamówienie przed informacją przy tym samym towarze", () => {
    const sorted = sortSupplierReceiveOrders([
      row({ id: "i1", request_kind: "informacja", quantity: "-" }),
      row({ id: "z1", request_kind: "zamowienie" }),
    ]);
    expect(sorted.map((o) => o.id)).toEqual(["z1", "i1"]);
  });

  it("łączy listy dostaw i informacji", () => {
    const mestra = { id: "s1", name: "Mestra" } as never;
    const merged = mergeReceiveQueueOrders(
      [
        row({
          id: "z1",
          request_kind: "zamowienie",
          supplier_id: "s1",
          supplier: mestra,
        }),
        row({
          id: "z2",
          request_kind: "zamowienie",
          supplier_id: "s2",
          supplier: { id: "s2", name: "Inny" } as never,
        }),
      ],
      [
        row({
          id: "i1",
          request_kind: "informacja",
          supplier_id: "s1",
          quantity: "-",
          supplier: mestra,
        }),
      ]
    );
    expect(merged).toHaveLength(3);
    const groups = groupReceiveQueueBySupplier(merged);
    expect(groups.filter((g) => g.supplierKey === "Mestra")).toHaveLength(1);
    expect(merged.filter((o) => supplierKey(o) === "Mestra").map((o) => o.id)).toEqual([
      "z1",
      "i1",
    ]);
  });

  it("dzieli zaznaczenie na typy", () => {
    const orders = [
      row({ id: "z1", request_kind: "zamowienie" }),
      row({ id: "i1", request_kind: "informacja", quantity: "-" }),
    ];
    const parts = partitionReceiveSelection(orders, ["z1", "i1"]);
    expect(parts.zamowienie).toHaveLength(1);
    expect(parts.informacja).toHaveLength(1);
  });
});
