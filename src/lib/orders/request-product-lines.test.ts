import { describe, expect, it } from "vitest";
import {
  appendProductLine,
  newProductLine,
  removeProductLineAt,
} from "@/components/orders/request-product-lines";

describe("request-product-lines", () => {
  it("removeProductLineAt zostawia co najmniej minLines", () => {
    const a = newProductLine();
    const next = removeProductLineAt([a], 0, 1);
    expect(next).toHaveLength(1);
    expect(next[0].id).toBe(a.id);
  });

  it("appendProductLine dodaje wiersz", () => {
    const a = newProductLine();
    const next = appendProductLine([a]);
    expect(next).toHaveLength(2);
    expect(next[1].id).not.toBe(a.id);
  });
});
