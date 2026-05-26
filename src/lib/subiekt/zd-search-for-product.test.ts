import { describe, expect, it } from "vitest";
import { zdSearchPlansForProduct, zdSearchTokensFromProduct } from "./zd-search-for-product";
import type { SubiektProduct } from "@/lib/subiekt/types";

describe("zdSearchTokensFromProduct", () => {
  it("buduje frazy z nazwy, nie z samego symbolu numerycznego", () => {
    const product: SubiektProduct = {
      tw_Id: 2319,
      tw_Symbol: "00187",
      tw_Nazwa: 'Viva Flex "LF" - 500g LF0',
    };
    const tokens = zdSearchTokensFromProduct(product);
    expect(tokens.some((t) => t.toLowerCase().includes("viva"))).toBe(true);
    expect(tokens.some((t) => t.toLowerCase().includes("flex"))).toBe(true);
    expect(tokens).not.toContain("00187");
    expect(tokens.indexOf("Flex")).toBeLessThan(tokens.indexOf("Viva"));
  });

  it("zawiera symbol alfanumeryczny", () => {
    const product: SubiektProduct = {
      tw_Id: 1,
      tw_Symbol: "ABC-12",
      tw_Nazwa: "Test",
    };
    expect(zdSearchTokensFromProduct(product)).toContain("ABC-12");
  });
});

describe("zdSearchPlansForProduct", () => {
  it("używa wyłącznie parametru search", () => {
    const plans = zdSearchPlansForProduct({
      tw_Id: 1,
      tw_Symbol: "00187",
      tw_Nazwa: "Viva Flex test",
    });
    expect(plans.length).toBeGreaterThan(0);
    for (const p of plans) {
      expect(p.search).toBeTruthy();
      expect(p.name).toBeUndefined();
      expect(p.symbol).toBeUndefined();
    }
  });
});
