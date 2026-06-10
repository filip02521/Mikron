import { describe, expect, it } from "vitest";
import type { MyOrderRow } from "@/lib/orders/my-order-presenter";
import {
  appendMojeFocusOrderIds,
  findMyOrderRowIdsForFocusOrderIds,
  parseMojeFocusOrderIds,
} from "./moje-order-focus";

function row(id: string, orderIds: string[]): MyOrderRow {
  return { id, orderIds } as MyOrderRow;
}

describe("parseMojeFocusOrderIds", () => {
  it("parsuje listę ID", () => {
    expect(parseMojeFocusOrderIds("a,b, a")).toEqual(["a", "b"]);
  });
});

describe("appendMojeFocusOrderIds", () => {
  it("dopisuje focusOrders do linku", () => {
    expect(appendMojeFocusOrderIds("/moje?klient=A", ["o1", "o2"])).toBe(
      "/moje?klient=A&focusOrders=o1%2Co2"
    );
  });
});

describe("findMyOrderRowIdsForFocusOrderIds", () => {
  it("znajduje wiersze po ID prośby", () => {
    const rows = [row("ship-1", ["o1", "o2"]), row("ship-2", ["o3"])];
    expect(findMyOrderRowIdsForFocusOrderIds(rows, ["o2"])).toEqual(["ship-1"]);
    expect(findMyOrderRowIdsForFocusOrderIds(rows, ["o3", "missing"])).toEqual(["ship-2"]);
  });
});
