import { describe, expect, it, vi, type Mock } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

import { createAdminClient } from "@/lib/supabase/admin";
import { searchProductCatalogSuggestions } from "./product-catalog-suggest";

function mockSupabase(rows: unknown[]) {
  const limitFn = vi.fn(() => Promise.resolve({ data: rows, error: null }));
  const orderFn = vi.fn(() => ({ limit: limitFn }));
  const orFn = vi.fn(() => ({ order: orderFn }));
  const selectFn = vi.fn(() => ({ or: orFn }));
  const fromFn = vi.fn(() => ({ select: selectFn }));
  (createAdminClient as unknown as Mock).mockReturnValue({ from: fromFn });
}

describe("searchProductCatalogSuggestions", () => {
  it("zwraca produkty z ostatnio używanym dostawcą (format PostgREST — obiekt)", async () => {
    mockSupabase([
      {
        subiekt_tw_id: 42,
        symbol: "ABC",
        name: "Śruba",
        plu: "123",
        product_supplier_links: [
          {
            supplier_id: "sup-1",
            order_count: 5,
            last_action_at: "2026-01-15T10:00:00Z",
            last_source: "order_history",
            suppliers: { id: "sup-1", name: "Dostawca A" },
          },
          {
            supplier_id: "sup-2",
            order_count: 2,
            last_action_at: "2026-01-10T10:00:00Z",
            last_source: "zd_import",
            suppliers: { id: "sup-2", name: "Dostawca B" },
          },
        ],
      },
    ]);

    const result = await searchProductCatalogSuggestions("śruba");
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      subiektTwId: 42,
      symbol: "ABC",
      name: "Śruba",
      plu: "123",
      topSupplier: { id: "sup-1", name: "Dostawca A" },
    });
  });

  it("zwraca pustą listę dla pustego zapytania", async () => {
    const result = await searchProductCatalogSuggestions("");
    expect(result).toEqual([]);
  });

  it("zwraca produkt bez dostawcy gdy brak linków", async () => {
    mockSupabase([
      {
        subiekt_tw_id: 10,
        symbol: "XYZ",
        name: "Kabel",
        plu: "999",
        product_supplier_links: [],
      },
    ]);

    const result = await searchProductCatalogSuggestions("kabel");
    expect(result).toHaveLength(1);
    expect(result[0].topSupplier).toBeNull();
    expect(result[0].subiektTwId).toBe(10);
  });

  it("zwraca produkt z null w linkach suppliers", async () => {
    mockSupabase([
      {
        subiekt_tw_id: 7,
        symbol: "NULL",
        name: "Test",
        plu: null,
        product_supplier_links: [
          {
            supplier_id: "sup-x",
            order_count: 0,
            last_action_at: null,
            last_source: null,
            suppliers: null,
          },
        ],
      },
    ]);

    const result = await searchProductCatalogSuggestions("test");
    expect(result).toHaveLength(1);
    expect(result[0].topSupplier).toBeNull();
  });

  it("zwraca dostawcę gdy PostgREST zwraca suppliers jako obiekt (many-to-one)", async () => {
    mockSupabase([
      {
        subiekt_tw_id: 99,
        symbol: "OBJ",
        name: "Obiekt",
        plu: "456",
        product_supplier_links: [
          {
            supplier_id: "sup-obj",
            order_count: 3,
            last_action_at: "2026-01-20T10:00:00Z",
            last_source: "order_history",
            suppliers: { id: "sup-obj", name: "Dostawca Obj" },
          },
        ],
      },
    ]);

    const result = await searchProductCatalogSuggestions("obiekt");
    expect(result).toHaveLength(1);
    expect(result[0].topSupplier).not.toBeNull();
    expect(result[0].topSupplier?.id).toBe("sup-obj");
    expect(result[0].topSupplier?.name).toBe("Dostawca Obj");
  });

  it("sortuje dostawców po order_count zamiast last_action_at", async () => {
    mockSupabase([
      {
        subiekt_tw_id: 55,
        symbol: "SORT",
        name: "SortTest",
        plu: "789",
        product_supplier_links: [
          {
            supplier_id: "sup-freq",
            order_count: 10,
            last_action_at: "2026-01-01T10:00:00Z",
            last_source: "order_history",
            suppliers: { id: "sup-freq", name: "Częsty dostawca" },
          },
          {
            supplier_id: "sup-recent",
            order_count: 1,
            last_action_at: "2026-06-01T10:00:00Z",
            last_source: "order_history",
            suppliers: { id: "sup-recent", name: "Ostatni dostawca" },
          },
        ],
      },
    ]);

    const result = await searchProductCatalogSuggestions("sort");
    expect(result[0].topSupplier?.id).toBe("sup-freq");
  });

  it("rzuci błąd przy błędzie bazy", async () => {
    const limitFn = vi.fn(() => Promise.resolve({ data: null, error: { message: "DB error" } }));
    const orderFn = vi.fn(() => ({ limit: limitFn }));
    const orFn = vi.fn(() => ({ order: orderFn }));
    const selectFn = vi.fn(() => ({ or: orFn }));
    const fromFn = vi.fn(() => ({ select: selectFn }));
    (createAdminClient as unknown as Mock).mockReturnValue({ from: fromFn });

    await expect(searchProductCatalogSuggestions("x")).rejects.toThrow("DB error");
  });
});
