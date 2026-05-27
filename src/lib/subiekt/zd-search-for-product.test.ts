import { describe, expect, it } from "vitest";
import {
  brandTokensFromProductName,
  zdSearchTokensFromProduct,
  zdSearchPlansForOrderInput,
  zdSearchPlansForProductSupplierLookup,
} from "./zd-search-for-product";

describe("zdSearchPlansForOrderInput", () => {
  it("dla numerycznego symbolu buduje plany z nazwy towaru", () => {
    const plans = zdSearchPlansForOrderInput({
      symbol: "00187",
      products: "Viva Flex polish",
      subiekt_tw_id: 2319,
    });
    expect(plans.length).toBeGreaterThan(0);
    expect(plans.every((p) => "search" in p && p.search)).toBe(true);
    expect(plans.some((p) => p.search?.toLowerCase().includes("viva"))).toBe(true);
  });

  it("wyciąga markę Renfert z nazwy z łącznikiem", () => {
    expect(brandTokensFromProductName("Renfert-Waxlectric Light I")).toContain("Renfert");
  });

  it("planuje wyszukiwanie ZD po symbolu numerycznym (symbol + search)", () => {
    const plans = zdSearchPlansForProductSupplierLookup(
      {
        tw_Id: 999,
        tw_Symbol: "18080500",
        tw_Nazwa: "Renfert-Obcinarka MT3+tarcza Marathon 18080500",
      },
      [{ id: "renfert", name: "renfert - excel", subiektKhId: 17465 }]
    );
    expect(plans.some((p) => p.symbol === "18080500" && p.search === "18080500")).toBe(true);
  });

  it("planuje wyszukiwanie ZD po marce i kh_Id dostawcy", () => {
    const plans = zdSearchPlansForProductSupplierLookup(
      {
        tw_Id: 198,
        tw_Symbol: "21500000",
        tw_Nazwa: "Renfert-Waxlectric Light I",
      },
      [{ id: "renfert", name: "renfert - excel", subiektKhId: 17465 }]
    );
    expect(plans.some((p) => p.search === "Renfert" && p.khId === 17465)).toBe(true);
  });

  it("nie ucina długiego numerycznego symbolu przez limit tokenów", () => {
    const tokens = zdSearchTokensFromProduct(
      {
        tw_Id: 1,
        tw_Symbol: "18080500",
        // dużo słów, żeby przekroczyć limit
        tw_Nazwa: "Bardzo długa nazwa produktu testowego z wieloma tokenami Renfert Waxlectric Light Extra",
      },
      6
    );
    expect(tokens).toContain("18080500");
  });

  it("wyciąga długi kod numeryczny z nazwy gdy brak symbolu", () => {
    const tokens = zdSearchTokensFromProduct(
      {
        tw_Id: 1,
        tw_Symbol: "-",
        tw_Nazwa: "Renfert-Obcinarka MT3+tarcza Marathon 18080500",
      },
      8
    );
    expect(tokens).toContain("18080500");
  });

  it("rozbija tokeny z łącznikami i plusami (MT3+tarcza)", () => {
    const tokens = zdSearchTokensFromProduct(
      {
        tw_Id: 1,
        tw_Symbol: "18080500",
        tw_Nazwa: "Renfert-Obcinarka MT3+tarcza Marathon 18080500",
      },
      12
    );
    expect(tokens).toContain("Renfert");
    expect(tokens.some((t) => t.toLowerCase() === "mt3")).toBe(true);
    expect(tokens.some((t) => t.toLowerCase() === "tarcza")).toBe(true);
  });

  it("dodaje khId do planów gdy dostawca jest powiązany", () => {
    const plans = zdSearchPlansForOrderInput({
      symbol: "ABC",
      products: "Produkt test",
      subiekt_kh_id: 688,
    });
    expect(plans.length).toBeGreaterThan(0);
    expect(plans.every((p) => p.khId === 688)).toBe(true);
  });
});
