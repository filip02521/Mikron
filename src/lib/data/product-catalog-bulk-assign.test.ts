import { describe, expect, it } from "vitest";
import { normalizeProductCatalogBulkTwIds } from "@/lib/data/product-catalog";

describe("normalizeProductCatalogBulkTwIds", () => {
  it("usuwa duplikaty i nieprawidłowe id", () => {
    expect(normalizeProductCatalogBulkTwIds([10, 10, 0, -1, 20, NaN])).toEqual([10, 20]);
  });

  it("ogranicza liczbę id do limitu bulk", () => {
    const ids = Array.from({ length: 200 }, (_, i) => i + 1);
    expect(normalizeProductCatalogBulkTwIds(ids)).toHaveLength(150);
  });
});
