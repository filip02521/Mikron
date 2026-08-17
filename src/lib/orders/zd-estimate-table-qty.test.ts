import { describe, expect, it } from "vitest";
import {
  formatZdEstimateTableQty,
  isZdEstimateTableQtyZero,
} from "@/lib/orders/zd-estimate-table-qty";

describe("formatZdEstimateTableQty", () => {
  it("returns dash for non-finite", () => {
    expect(formatZdEstimateTableQty(Number.NaN)).toBe("—");
    expect(formatZdEstimateTableQty(Number.POSITIVE_INFINITY)).toBe("—");
  });

  it("keeps small integers without grouping", () => {
    expect(formatZdEstimateTableQty(0)).toBe("0");
    expect(formatZdEstimateTableQty(42)).toBe("42");
    expect(formatZdEstimateTableQty(999)).toBe("999");
  });

  it("groups integers >= 1000 with pl-PL", () => {
    const g1000 = formatZdEstimateTableQty(1000);
    const g12500 = formatZdEstimateTableQty(12500);
    const gNeg = formatZdEstimateTableQty(-1500);
    expect(g1000.replace(/[\s\u00a0\u202f]/g, "")).toBe("1000");
    expect(g1000.length).toBeGreaterThan(4);
    expect(g12500.replace(/[\s\u00a0\u202f]/g, "")).toBe("12500");
    expect(g12500.length).toBeGreaterThan(5);
    expect(gNeg.replace(/[\s\u00a0\u202f]/g, "")).toBe("-1500");
  });

  it("formats fractions with pl-PL", () => {
    const s = formatZdEstimateTableQty(12.5);
    expect(s).toMatch(/12[,.]5/);
  });
});

describe("isZdEstimateTableQtyZero", () => {
  it("detects near-zero", () => {
    expect(isZdEstimateTableQtyZero(0)).toBe(true);
    expect(isZdEstimateTableQtyZero(1e-12)).toBe(true);
    expect(isZdEstimateTableQtyZero(1)).toBe(false);
    expect(isZdEstimateTableQtyZero(Number.NaN)).toBe(false);
  });
});
