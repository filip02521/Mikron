import { describe, expect, it } from "vitest";
import {
  mergeUniqueTwIds,
  formatCatalogSupplierSubtitle,
  type ProductCatalogRow,
} from "@/lib/data/product-catalog-queries";

function row(partial: Partial<ProductCatalogRow> & { subiektTwId: number }): ProductCatalogRow {
  return {
    symbol: null,
    name: null,
    plu: null,
    note: "",
    lastSeenAt: "",
    totalOrders: 0,
    topSupplier: null,
    lastActionAt: null,
    ...partial,
  };
}

describe("mergeUniqueTwIds", () => {
  it("scala grupy bez duplikatów", () => {
    expect(mergeUniqueTwIds([1, 2, 3], [2, 4, 99])).toEqual([1, 2, 3, 4, 99]);
  });
});

describe("formatCatalogSupplierSubtitle", () => {
  it("pokazuje dostawcę z filtra i głównego gdy się różnią", () => {
    const text = formatCatalogSupplierSubtitle(
      row({
        subiektTwId: 1,
        topSupplier: { id: "b", name: "Beta", orderCount: 12 },
      }),
      "a",
      "Alfa"
    );
    expect(text).toBe("Alfa (filtr) · główny: Beta (12)");
  });

  it("bez filtra pokazuje głównego dostawcę", () => {
    const text = formatCatalogSupplierSubtitle(
      row({
        subiektTwId: 1,
        topSupplier: { id: "a", name: "Alfa", orderCount: 3 },
      }),
      null,
      null
    );
    expect(text).toBe("Alfa (3)");
  });
});
