import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/data/teeth-products", () => ({
  fetchTeethProductTwIdSet: vi.fn(),
  fetchTeethProductInfo: vi.fn(),
}));

import {
  fetchTeethProductInfo,
  fetchTeethProductTwIdSet,
} from "@/lib/data/teeth-products";
import {
  loadTeethCatalogForValidation,
  TEETH_CATALOG_UNAVAILABLE_MESSAGE,
} from "./teeth-catalog-load";

const mockTwIds = vi.mocked(fetchTeethProductTwIdSet);
const mockInfo = vi.mocked(fetchTeethProductInfo);

describe("loadTeethCatalogForValidation", () => {
  beforeEach(() => {
    mockTwIds.mockReset();
    mockInfo.mockReset();
  });

  it("zwraca katalog przy sukcesie", async () => {
    mockTwIds.mockResolvedValue(new Set([1]));
    mockInfo.mockResolvedValue([
      {
        twId: 1,
        manufacturer: "ivoclar",
        productLine: "ivoclar_phonares_ii",
        kind: "anterior",
        symbol: "A",
        name: "Phonares",
        plu: null,
      },
    ]);
    const result = await loadTeethCatalogForValidation();
    expect(result.twIdSet.has(1)).toBe(true);
    expect(result.infoByTwId.get(1)?.name).toBe("Phonares");
  });

  it("fail-closed przy błędzie fetch", async () => {
    mockTwIds.mockRejectedValue(new Error("db down"));
    mockInfo.mockResolvedValue([]);
    await expect(loadTeethCatalogForValidation()).rejects.toThrow(
      TEETH_CATALOG_UNAVAILABLE_MESSAGE
    );
  });
});
