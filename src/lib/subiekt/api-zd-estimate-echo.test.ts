import { describe, expect, it, vi } from "vitest";
import {
  fetchSubiektZdEstimateAll,
  SubiektZdEstimateFirstPageRejectedError,
} from "@/lib/subiekt/api";
import { assertZdEstimateFilterEcho } from "@/lib/orders/zd-estimate-scope";

vi.mock("@/lib/subiekt/config", () => ({
  resolveSubiektOrdersConfig: () => ({
    ok: true as const,
    config: {
      baseUrl: "http://test.local/api/v1",
      apiKey: "x",
      timeoutMs: 5000,
    },
  }),
}));

const pageMock = vi.fn();

vi.mock("@/lib/subiekt/client", () => ({
  subiektJson: (...args: unknown[]) => pageMock(...args),
}));

describe("fetchSubiektZdEstimateAll validateFirstPage", () => {
  it("aborts before page 2 when echo fails", async () => {
    pageMock.mockReset();
    pageMock.mockResolvedValueOnce({
      data: {
        parametry: { /* brak cechaId — stary API */ },
        pozycje: [{ tw_Id: 1 }],
      },
      pagination: { totalPages: 5, totalCount: 900 },
    });

    await expect(
      fetchSubiektZdEstimateAll(
        { cechaId: 2738, dniZapasu: 30 },
        {
          validateFirstPage: ({ parametry }) =>
            assertZdEstimateFilterEcho({
              mode: "cecha",
              expectedGrupaId: null,
              expectedCechaId: 2738,
              parametry,
            }),
        }
      )
    ).rejects.toBeInstanceOf(SubiektZdEstimateFirstPageRejectedError);

    expect(pageMock).toHaveBeenCalledTimes(1);
  });

  it("continues pagination when echo matches", async () => {
    pageMock.mockReset();
    pageMock
      .mockResolvedValueOnce({
        data: {
          parametry: { cechaId: 2738 },
          pozycje: [{ tw_Id: 1 }],
        },
        pagination: { totalPages: 2, totalCount: 2 },
      })
      .mockResolvedValueOnce({
        data: {
          parametry: { cechaId: 2738 },
          pozycje: [{ tw_Id: 2 }],
        },
        pagination: { totalPages: 2, totalCount: 2 },
      });

    const result = await fetchSubiektZdEstimateAll(
      { cechaId: 2738, dniZapasu: 30 },
      {
        validateFirstPage: ({ parametry }) =>
          assertZdEstimateFilterEcho({
            mode: "cecha",
            expectedGrupaId: null,
            expectedCechaId: 2738,
            parametry,
          }),
      }
    );

    expect(pageMock).toHaveBeenCalledTimes(2);
    expect(result.pozycje.map((p) => p.tw_Id)).toEqual([1, 2]);
    expect(result.parametry.cechaId).toBe(2738);
  });

  it("merges parallel pages in page order and stops at first empty batch", async () => {
    pageMock.mockReset();
    pageMock.mockImplementation(async (path: string) => {
      const page = Number(new URL(path, "http://x").searchParams.get("page") ?? "1");
      if (page === 1) {
        return {
          data: { parametry: { cechaId: 2738 }, pozycje: [{ tw_Id: 1 }] },
          pagination: { totalPages: 4, totalCount: 4 },
        };
      }
      if (page === 2) {
        await new Promise((r) => setTimeout(r, 30));
        return {
          data: { parametry: { cechaId: 2738 }, pozycje: [{ tw_Id: 2 }] },
          pagination: { totalPages: 4, totalCount: 4 },
        };
      }
      if (page === 3) {
        return {
          data: { parametry: { cechaId: 2738 }, pozycje: [] },
          pagination: { totalPages: 4, totalCount: 4 },
        };
      }
      // page 4 would have data, but sequential semantics stop at empty page 3
      return {
        data: { parametry: { cechaId: 2738 }, pozycje: [{ tw_Id: 99 }] },
        pagination: { totalPages: 4, totalCount: 4 },
      };
    });

    const result = await fetchSubiektZdEstimateAll(
      { cechaId: 2738, dniZapasu: 30 },
      {
        validateFirstPage: ({ parametry }) =>
          assertZdEstimateFilterEcho({
            mode: "cecha",
            expectedGrupaId: null,
            expectedCechaId: 2738,
            parametry,
          }),
      }
    );

    expect(result.pozycje.map((p) => p.tw_Id)).toEqual([1, 2]);
    expect(result.pagesFetched).toBe(2);
    expect(result.truncated).toBe(true);
    // Strona 4 mogła być w locie, ale wynik jej nie zawiera.
    expect(result.pozycje.some((p) => p.tw_Id === 99)).toBe(false);
  });

  it("po pustej stronie nie claimuje kolejnych (pipeline)", async () => {
    pageMock.mockReset();
    const seenPages: number[] = [];
    pageMock.mockImplementation(async (path: string) => {
      const page = Number(
        new URL(path, "http://x").searchParams.get("page") ?? "1"
      );
      seenPages.push(page);
      if (page === 1) {
        return {
          data: { parametry: { cechaId: 1 }, pozycje: [{ tw_Id: 1 }] },
          pagination: { totalPages: 8, totalCount: 8 },
        };
      }
      if (page === 2) {
        return {
          data: { parametry: { cechaId: 1 }, pozycje: [] },
          pagination: { totalPages: 8, totalCount: 8 },
        };
      }
      await new Promise((r) => setTimeout(r, 40));
      return {
        data: { parametry: { cechaId: 1 }, pozycje: [{ tw_Id: page }] },
        pagination: { totalPages: 8, totalCount: 8 },
      };
    });

    const result = await fetchSubiektZdEstimateAll(
      { cechaId: 1, dniZapasu: 30, pageSize: 200 },
      {
        validateFirstPage: () => ({ ok: true as const }),
      }
    );

    expect(result.pozycje.map((p) => p.tw_Id)).toEqual([1]);
    expect(result.pagesFetched).toBe(1);
    // Bez pipeline „fala 4” poszłaby po 2..5; po empty na 2 nie powinno być 6+.
    expect(seenPages.some((p) => p >= 6)).toBe(false);
  });
});
