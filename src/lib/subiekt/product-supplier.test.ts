import { describe, expect, it, vi, beforeEach } from "vitest";
import type { SubiektProduct } from "@/lib/subiekt/types";

vi.mock("@/lib/subiekt/availability", () => ({
  isSubiektReachable: vi.fn(async () => true),
}));

vi.mock("@/lib/subiekt/subiekt-runtime-cache", () => ({
  defaultZdSearchDataOd: () => "2024-01-01",
  searchSubiektZdCached: vi.fn(),
  getSubiektDocumentCached: vi.fn(),
}));

import {
  getSubiektDocumentCached,
  searchSubiektZdCached,
} from "@/lib/subiekt/subiekt-runtime-cache";
import { resolveSupplierForSubiektProduct } from "./product-supplier";

const suppliers = [{ id: "sup-1", name: "Dental Flex Italia Srl", subiektKhId: 1 }];

const product: SubiektProduct = {
  tw_Id: 2319,
  tw_Symbol: "00187",
  tw_Nazwa: 'Viva Flex "LF" - 500g LF0',
};

describe("resolveSupplierForSubiektProduct", () => {
  beforeEach(() => {
    vi.mocked(searchSubiektZdCached).mockReset();
    vi.mocked(getSubiektDocumentCached).mockReset();
  });

  it("dopasowuje dostawcę po ob_TowId w pozycji ZD", async () => {
    vi.mocked(searchSubiektZdCached).mockResolvedValue({
      data: [{ dok_Id: 1777260 }],
      pagination: { page: 1, pageSize: 25, totalCount: 1, totalPages: 1 },
    });
    vi.mocked(getSubiektDocumentCached).mockResolvedValue({
      dok_Id: 1777260,
      dok_NrPelny: "ZD 148/M/04/2026",
      kh__Kontrahent_Odbiorca: {
        kh_Id: 1,
        adr_NazwaPelna: "Dental Flex Italia Srl",
      },
      dok_Pozycja: [{ ob_TowId: 2319, tw_Symbol: "00187", tw_Nazwa: "Viva Flex" }],
    });

    const result = await resolveSupplierForSubiektProduct(product, suppliers);
    expect(result?.supplierId).toBe("sup-1");
    expect(result?.documentNumber).toBe("ZD 148/M/04/2026");
  });

  it("zwraca null gdy brak dopasowania w aplikacji", async () => {
    vi.mocked(searchSubiektZdCached).mockResolvedValue({
      data: [{ dok_Id: 1 }],
      pagination: { page: 1, pageSize: 25, totalCount: 1, totalPages: 1 },
    });
    vi.mocked(getSubiektDocumentCached).mockResolvedValue({
      dok_Id: 1,
      dok_NrPelny: "ZD 1",
      kh__Kontrahent_Odbiorca: {
        kh_Id: 2,
        adr_NazwaPelna: "Nieznany dostawca Sp. z o.o.",
      },
      dok_Pozycja: [{ ob_TowId: 2319 }],
    });

    const result = await resolveSupplierForSubiektProduct(product, suppliers);
    expect(result).toBeNull();
  });

  it("dopasowuje Renfert po marce i kh_Id (nie po całej nazwie z łącznikiem)", async () => {
    const renfertSuppliers = [
      { id: "renfert", name: "renfert - excel", subiektKhId: 17465 },
    ];
    const renfertProduct: SubiektProduct = {
      tw_Id: 198,
      tw_Symbol: "21500000",
      tw_Nazwa: "Renfert-Waxlectric Light I",
    };

    vi.mocked(searchSubiektZdCached).mockImplementation(async (params) => {
      if (params.search === "Renfert" && params.khId === 17465) {
        return {
          data: [{ dok_Id: 1781359 }],
          pagination: { page: 1, pageSize: 25, totalCount: 1, totalPages: 1 },
        };
      }
      return {
        data: [],
        pagination: { page: 1, pageSize: 25, totalCount: 0, totalPages: 0 },
      };
    });
    vi.mocked(getSubiektDocumentCached).mockResolvedValue({
      dok_Id: 1781359,
      dok_NrPelny: "ZD/R/1",
      dok_DataWyst: "2026-05-01",
      kh__Kontrahent_Odbiorca: {
        kh_Id: 17465,
        adr_NazwaPelna: "Renfert GmbH",
        kh_Symbol: "RENFERT",
      },
      dok_Pozycja: [{ ob_TowId: 198, tw_Symbol: "21500000", tw_Nazwa: "Renfert-Waxlectric Light I" }],
    });

    const result = await resolveSupplierForSubiektProduct(renfertProduct, renfertSuppliers);
    expect(result?.supplierId).toBe("renfert");
    expect(vi.mocked(searchSubiektZdCached)).toHaveBeenCalledWith(
      expect.objectContaining({ search: "Renfert", khId: 17465 })
    );
  });

  it("szuka ZD po nazwie towaru gdy symbol jest numeryczny", async () => {
    vi.mocked(searchSubiektZdCached).mockImplementation(async (params) => {
      if (params.search?.toLowerCase().includes("flex")) {
        return {
          data: [{ dok_Id: 1777260 }],
          pagination: { page: 1, pageSize: 25, totalCount: 1, totalPages: 1 },
        };
      }
      return {
        data: [],
        pagination: { page: 1, pageSize: 25, totalCount: 0, totalPages: 0 },
      };
    });
    vi.mocked(getSubiektDocumentCached).mockResolvedValue({
      dok_Id: 1777260,
      dok_NrPelny: "ZD 148/M/04/2026",
      kh__Kontrahent_Odbiorca: {
        kh_Id: 1,
        adr_NazwaPelna: "Dental Flex Italia Srl",
      },
      dok_Pozycja: [{ ob_TowId: 2319, tw_Symbol: "00187" }],
    });

    const result = await resolveSupplierForSubiektProduct(product, suppliers);
    expect(result?.supplierId).toBe("sup-1");
    expect(vi.mocked(searchSubiektZdCached)).toHaveBeenCalledWith(
      expect.objectContaining({ search: expect.stringMatching(/flex/i) })
    );
  });
});
