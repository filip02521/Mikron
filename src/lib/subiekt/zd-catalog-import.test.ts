import { describe, expect, it, vi, beforeEach } from "vitest";
import { SubiektRequestError } from "./errors";
import { importZdDocumentToCatalog, lineTowId } from "./zd-catalog-import";

const getSubiektZdDocumentCached = vi.fn();

vi.mock("@/lib/subiekt/subiekt-runtime-cache", () => ({
  getSubiektZdDocumentCached: (...args: unknown[]) => getSubiektZdDocumentCached(...args),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      update: () => ({
        eq: () => Promise.resolve({ error: null }),
      }),
    }),
  }),
}));

describe("importZdDocumentToCatalog", () => {
  beforeEach(() => {
    getSubiektZdDocumentCached.mockReset();
  });

  it("pomija dokument usunięty w Subiekcie (404)", async () => {
    getSubiektZdDocumentCached.mockRejectedValue(new SubiektRequestError(404, "not found"));
    const res = await importZdDocumentToCatalog(999, "sup-1");
    expect(res.skipped).toBe(true);
    expect(res.skipReason).toBe("not_found");
    expect(res.linksUpserted).toBe(0);
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
