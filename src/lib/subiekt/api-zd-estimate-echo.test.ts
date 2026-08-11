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
});
