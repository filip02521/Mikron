import { describe, expect, it } from "vitest";
import {
  combineStockNeedWithExtra,
  parseZdEstimateExtrasPolicy,
} from "./zd-estimate-extras-policy";

describe("parseZdEstimateExtrasPolicy", () => {
  it("sum domyślnie", () => {
    expect(parseZdEstimateExtrasPolicy(null)).toBe("sum");
    expect(parseZdEstimateExtrasPolicy({ policy: "max" })).toBe("max");
  });
});

describe("combineStockNeedWithExtra", () => {
  it("sum dokłada rezerwę", () => {
    expect(combineStockNeedWithExtra(10, 4, "sum")).toBe(14);
  });

  it("max nie dubluje gdy prośba ≤ need", () => {
    expect(combineStockNeedWithExtra(10, 4, "max")).toBe(10);
    expect(combineStockNeedWithExtra(10, 25, "max")).toBe(25);
  });

  it("brak extra = stock", () => {
    expect(combineStockNeedWithExtra(8, 0, "max")).toBe(8);
  });
});
