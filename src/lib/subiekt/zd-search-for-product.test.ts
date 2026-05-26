import { describe, expect, it } from "vitest";
import {
  brandTokensFromProductName,
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
