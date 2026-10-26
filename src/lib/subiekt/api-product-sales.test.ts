import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchSubiektProductSalesDocs } from "@/lib/subiekt/api";

vi.mock("@/lib/subiekt/config", () => ({
  resolveSubiektOrdersConfig: () => ({
    ok: true as const,
    config: { baseUrl: "http://test.local/api/v1", apiKey: "x", timeoutMs: 5000 },
  }),
}));

const pageMock = vi.fn();
vi.mock("@/lib/subiekt/client", () => ({
  subiektJson: (...args: unknown[]) => pageMock(...args),
}));

const docs = (n: number, page: number) =>
  Array.from({ length: n }, (_, i) => ({ rola: "fs", dok_Id: page * 1000 + i, ob_Ilosc: 1 }));
const input = { towarId: 7, dataOd: "2025-11-01", dataDo: "2026-10-21" };

describe("fetchSubiektProductSalesDocs", () => {
  beforeEach(() => pageMock.mockReset());

  it("znana liczba stron: wszystkie strony, w kolejności", async () => {
    pageMock.mockImplementation(async (url: string) => {
      const page = Number(/page=(\d+)/.exec(url)?.[1]);
      return { data: { dokumenty: docs(page < 3 ? 200 : 5, page) }, pagination: { totalPages: 3 } };
    });
    const r = await fetchSubiektProductSalesDocs(input);
    expect(r.rows).toHaveLength(405);
    expect(r.rows[200]!.dokId).toBe(2000);
    expect(r.truncated).toBe(false);
  });

  it("bez paginacji: dociąga, dopóki strona jest pełna", async () => {
    pageMock
      .mockResolvedValueOnce({ data: { dokumenty: docs(200, 1) } })
      .mockResolvedValueOnce({ data: { dokumenty: docs(30, 2) } });
    const r = await fetchSubiektProductSalesDocs(input);
    expect(pageMock).toHaveBeenCalledTimes(2);
    expect(r.rows).toHaveLength(230);
    expect(r.truncated).toBe(false);
  });
});
