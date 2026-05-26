import { describe, expect, it, vi, beforeEach } from "vitest";
import type { SubiektProduct } from "@/lib/subiekt/types";

vi.mock("@/lib/subiekt/availability", () => ({
  isSubiektReachable: vi.fn(async () => true),
}));

vi.mock("@/lib/subiekt/api", () => ({
  searchSubiektZd: vi.fn(),
  getSubiektDocument: vi.fn(),
}));

import { searchSubiektZd, getSubiektDocument } from "@/lib/subiekt/api";
import { resolveSupplierForSubiektProduct } from "./product-supplier";

const suppliers = [{ id: "sup-1", name: "Dental Flex Italia Srl" }];

const product: SubiektProduct = {
  tw_Id: 2319,
  tw_Symbol: "00187",
  tw_Nazwa: 'Viva Flex "LF" - 500g LF0',
};

describe("resolveSupplierForSubiektProduct", () => {
  beforeEach(() => {
    vi.mocked(searchSubiektZd).mockReset();
    vi.mocked(getSubiektDocument).mockReset();
  });

  it("dopasowuje dostawcę po ob_TowId w pozycji ZD", async () => {
    vi.mocked(searchSubiektZd).mockResolvedValue({
      data: [{ dok_Id: 1777260 }],
      pagination: { page: 1, pageSize: 25, totalCount: 1, totalPages: 1 },
    });
    vi.mocked(getSubiektDocument).mockResolvedValue({
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
    vi.mocked(searchSubiektZd).mockResolvedValue({
      data: [{ dok_Id: 1 }],
      pagination: { page: 1, pageSize: 25, totalCount: 1, totalPages: 1 },
    });
    vi.mocked(getSubiektDocument).mockResolvedValue({
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

  it("szuka ZD po nazwie towaru gdy symbol jest numeryczny", async () => {
    vi.mocked(searchSubiektZd).mockImplementation(async (params) => {
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
    vi.mocked(getSubiektDocument).mockResolvedValue({
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
    expect(vi.mocked(searchSubiektZd)).toHaveBeenCalledWith(
      expect.objectContaining({ search: expect.stringMatching(/flex/i) })
    );
  });
});
