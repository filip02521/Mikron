import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearSubiektRuntimeCache } from "./subiekt-runtime-cache";

vi.mock("@/lib/subiekt/availability", () => ({
  isSubiektReachable: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/lib/subiekt/subiekt-runtime-cache", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./subiekt-runtime-cache")>();
  return {
    ...actual,
    searchSubiektZdCached: vi.fn(),
    getSubiektDocumentCached: vi.fn(),
  };
});

import { resolveSubiektZdEtasForOrders } from "./zd-eta";
import {
  getSubiektDocumentCached,
  searchSubiektZdCached,
} from "./subiekt-runtime-cache";

describe("resolveSubiektZdEtasForOrders — optymalizacja zapytań", () => {
  beforeEach(() => {
    clearSubiektRuntimeCache();
    vi.mocked(searchSubiektZdCached).mockReset();
    vi.mocked(getSubiektDocumentCached).mockReset();
  });

  it("kończy po pierwszej udanej frazie — nie odpytuje kolejnych planów", async () => {
    vi.mocked(searchSubiektZdCached).mockResolvedValue({
      data: [
        {
          dok_Id: 100,
          dok_OdbiorcaId: 5,
          dok_TerminRealizacji: "2026-07-01",
          kh__Kontrahent_Odbiorca: { kh_Id: 5, adr_Nazwa: "Dostawca" },
        },
      ],
      pagination: { page: 1, pageSize: 12, totalCount: 1, totalPages: 1 },
    });

    vi.mocked(getSubiektDocumentCached).mockResolvedValue({
      dok_Id: 100,
      dok_OdbiorcaId: 5,
      dok_NrPelny: "ZD/1",
      dok_TerminRealizacji: "2026-07-01",
      dok_Pozycja: [{ tw_Symbol: "ABC", tw_Nazwa: "Produkt" }],
      kh__Kontrahent_Odbiorca: { kh_Id: 5, adr_Nazwa: "Dostawca" },
    });

    const etas = await resolveSubiektZdEtasForOrders([
      {
        id: "o1",
        symbol: "ABC",
        products: "Viva Flex polish extra",
        status: "Zamowione",
        request_kind: "zamowienie",
        supplier: { name: "Dostawca", subiekt_kh_id: 5 },
      },
    ]);

    expect(etas.o1?.realizationDate).toBe("2026-07-01");
    expect(vi.mocked(searchSubiektZdCached).mock.calls.length).toBe(1);
  });
});
