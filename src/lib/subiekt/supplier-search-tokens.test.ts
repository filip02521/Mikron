import { describe, expect, it } from "vitest";
import {
  expandSupplierSearchQueries,
  supplierNameMatchesQuery,
} from "./supplier-search-tokens";

describe("expandSupplierSearchQueries", () => {
  it("dodaje warianty dla ampersand", () => {
    const variants = expandSupplierSearchQueries("W&H");
    expect(variants.map((v) => v.toLowerCase())).toEqual(
      expect.arrayContaining(["w&h", "w h", "wh"])
    );
  });
});

describe("supplierNameMatchesQuery", () => {
  it("dopasowuje W&H do nazwy bez ampersanda", () => {
    expect(supplierNameMatchesQuery("W H Dental", "W&H")).toBe(true);
    expect(supplierNameMatchesQuery("WH Import", "W&H")).toBe(true);
  });
});
