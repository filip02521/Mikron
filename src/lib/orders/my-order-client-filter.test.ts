import { describe, expect, it } from "vitest";
import { filterMyOrderRowsByClient } from "./my-order-client-filter";
import type { MyOrderRow } from "@/lib/orders/my-order-presenter";
import { createTestMyOrderRow } from "./test-fixtures";

function row(partial: Partial<MyOrderRow>): MyOrderRow {
  return createTestMyOrderRow(partial);
}

describe("filterMyOrderRowsByClient", () => {
  it("filtruje po nazwie klienta", () => {
    const rows = [
      row({ id: "a", clientLabel: "Walczak Jacek" }),
      row({ id: "b", clientLabel: "Kowalski" }),
    ];
    expect(filterMyOrderRowsByClient(rows, "walczak").map((r) => r.id)).toEqual(["a"]);
  });
});
