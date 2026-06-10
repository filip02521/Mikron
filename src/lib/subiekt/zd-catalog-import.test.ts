import { describe, expect, it, vi, beforeEach } from "vitest";
import { SubiektRequestError } from "./errors";
import { importZdDocumentToCatalog, importAndMarkZdDocumentToCatalog, lineTowId } from "./zd-catalog-import";

const getSubiektZdDocumentCached = vi.fn();
const markCalls: number[][] = [];

let mockIndexRow: { supplier_id: string; subiekt_kh_id: number } | null = {
  supplier_id: "sup-1",
  subiekt_kh_id: 100,
};
let mockSupplierKhId: number | null = 100;

vi.mock("@/lib/subiekt/subiekt-runtime-cache", () => ({
  getSubiektZdDocumentCached: (...args: unknown[]) => getSubiektZdDocumentCached(...args),
}));

vi.mock("@/lib/data/product-catalog", () => ({
  upsertSubiektProduct: vi.fn().mockResolvedValue(undefined),
  bumpProductSupplierLinkBy: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === "subiekt_zd_index") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: mockIndexRow, error: null }),
            }),
          }),
          update: () => ({
            eq: () => Promise.resolve({ error: null }),
            in: (_col: string, ids: number[]) => {
              markCalls.push(ids);
              return Promise.resolve({ error: null });
            },
          }),
        };
      }
      if (table === "suppliers") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: mockSupplierKhId != null ? { subiekt_kh_id: mockSupplierKhId } : null,
                  error: null,
                }),
            }),
          }),
        };
      }
      return {};
    },
  }),
}));

const validDoc = {
  kh_Id: 100,
  dok_Pozycja: [{ ob_TowId: 1, tw_Symbol: "A", tw_Nazwa: "Prod" }],
};

describe("importZdDocumentToCatalog", () => {
  beforeEach(() => {
    getSubiektZdDocumentCached.mockReset();
    markCalls.length = 0;
    mockIndexRow = { supplier_id: "sup-1", subiekt_kh_id: 100 };
    mockSupplierKhId = 100;
  });

  it("pomija dokument usunięty w Subiekcie (404)", async () => {
    getSubiektZdDocumentCached.mockRejectedValue(new SubiektRequestError(404, "not found"));
    const res = await importZdDocumentToCatalog(999, "sup-1");
    expect(res.skipped).toBe(true);
    expect(res.skipReason).toBe("not_found");
    expect(res.linksUpserted).toBe(0);
  });

  it("pomija gdy indeks wskazuje innego dostawcę", async () => {
    mockIndexRow = { supplier_id: "sup-other", subiekt_kh_id: 100 };
    const res = await importZdDocumentToCatalog(42, "sup-1");
    expect(res.skipped).toBe(true);
    expect(res.skipReason).toBe("supplier_mismatch");
    expect(getSubiektZdDocumentCached).not.toHaveBeenCalled();
  });

  it("pomija gdy kontrahent dokumentu nie pasuje do dostawcy", async () => {
    getSubiektZdDocumentCached.mockResolvedValue({
      kh_Id: 999,
      dok_Pozycja: [{ ob_TowId: 1, tw_Symbol: "A", tw_Nazwa: "Prod" }],
    });
    const res = await importZdDocumentToCatalog(42, "sup-1");
    expect(res.skipped).toBe(true);
    expect(res.skipReason).toBe("index_mismatch");
  });

  it("importAndMark oznacza dokument po udanym imporcie", async () => {
    getSubiektZdDocumentCached.mockResolvedValue(validDoc);
    await importAndMarkZdDocumentToCatalog(42, "sup-1");
    expect(markCalls).toEqual([[42]]);
  });

  it("importAndMark nie podwaja oznaczenia przy 404", async () => {
    getSubiektZdDocumentCached.mockRejectedValue(new SubiektRequestError(404, "not found"));
    await importAndMarkZdDocumentToCatalog(999, "sup-1");
    expect(markCalls).toEqual([]);
  });

  it("importAndMark nie oznacza przy błędnym dostawcy", async () => {
    mockIndexRow = { supplier_id: "sup-other", subiekt_kh_id: 100 };
    await importAndMarkZdDocumentToCatalog(42, "sup-1");
    expect(markCalls).toEqual([]);
  });
});

describe("lineTowId", () => {
  it("zwraca tw_Id z linii dokumentu", () => {
    expect(lineTowId({ ob_TowId: 12345 } as never)).toBe(12345);
    expect(lineTowId({ ob_TowId: "99" } as never)).toBe(99);
  });

  it("pomija nieprawidłowe wartości", () => {
    expect(lineTowId({ ob_TowId: null } as never)).toBeNull();
    expect(lineTowId({ ob_TowId: 0 } as never)).toBeNull();
    expect(lineTowId({ ob_TowId: -1 } as never)).toBeNull();
    expect(lineTowId({} as never)).toBeNull();
  });
});
