import { describe, expect, it } from "vitest";
import { adminAssignPrimaryOrderCount } from "@/lib/data/product-catalog";

describe("adminAssignPrimaryOrderCount", () => {
  it("podbija order_count ponad dotychczasowego głównego dostawcę", () => {
    expect(
      adminAssignPrimaryOrderCount(
        [
          { supplierId: "old", orderCount: 42 },
          { supplierId: "new", orderCount: 1 },
        ],
        "new"
      )
    ).toBe(43);
  });

  it("działa przy pierwszym przypisaniu bez innych linków", () => {
    expect(adminAssignPrimaryOrderCount([], "new")).toBe(1);
  });

  it("nie obniża istniejącego wysokiego order_count wybranego dostawcy", () => {
    expect(
      adminAssignPrimaryOrderCount(
        [
          { supplierId: "a", orderCount: 5 },
          { supplierId: "b", orderCount: 100 },
        ],
        "b"
      )
    ).toBe(100);
  });
});
