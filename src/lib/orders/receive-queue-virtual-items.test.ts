import { describe, expect, it } from "vitest";
import {
  buildReceiveQueueVirtualItems,
  countReceiveQueueOrderRows,
  estimateReceiveQueueVirtualItemSize,
} from "./receive-queue-virtual-items";
import type { SupplierOrderGroup } from "@/lib/orders/queue-supplier-groups";
import type { IndividualOrder } from "@/types/database";

function order(id: string, supplier = "Dostawca A"): IndividualOrder {
  return {
    id,
    supplier_name: supplier,
    products: "Produkt testowy",
  } as IndividualOrder;
}

function group(supplierKey: string, orderIds: string[]): SupplierOrderGroup {
  return {
    supplierKey,
    orders: orderIds.map((id) => order(id, supplierKey)),
  };
}

describe("buildReceiveQueueVirtualItems", () => {
  it("dodaje wiersze tylko dla rozwiniętych grup", () => {
    const groups = [group("A", ["1", "2"]), group("B", ["3"])];
    const items = buildReceiveQueueVirtualItems(groups, (key) => key === "A");

    expect(items.map((i) => i.key)).toEqual([
      "header:A",
      "order:1",
      "order:2",
      "header:B",
    ]);
    expect(countReceiveQueueOrderRows(items)).toBe(2);
  });

  it("zawyża szacunek dla długiej nazwy produktu", () => {
    const longOrder = order("1");
    longOrder.products = "x".repeat(90);
    const tall = estimateReceiveQueueVirtualItemSize({
      kind: "order",
      key: "order:1",
      groupIndex: 0,
      rowIndex: 0,
      order: longOrder,
    });
    const short = estimateReceiveQueueVirtualItemSize({
      kind: "order",
      key: "order:2",
      groupIndex: 0,
      rowIndex: 1,
      order: order("2"),
    });
    expect(tall).toBeGreaterThan(short);
  });
});
