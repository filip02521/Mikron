import { describe, expect, it } from "vitest";
import { productZdLookupSupplierName } from "@/lib/orders/product-zd-lookup-ui";

describe("productZdLookupSupplierName", () => {
  it("zwraca dostawcę tylko dla found i no_match", () => {
    expect(
      productZdLookupSupplierName({
        status: "found",
        supplierId: "s1",
        supplierName: "Renfert",
        matches: [],
      })
    ).toBe("Renfert");
    expect(
      productZdLookupSupplierName({
        status: "no_match",
        supplierId: null,
        supplierName: null,
      })
    ).toBeNull();
    expect(
      productZdLookupSupplierName({
        status: "offline",
        message: "offline",
      })
    ).toBeNull();
  });
});
