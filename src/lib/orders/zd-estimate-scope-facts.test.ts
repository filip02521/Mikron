import { describe, expect, it } from "vitest";
import {
  buildZdEstimateScopeFactParts,
  zdEstimateSupplierFactIsRedundant,
} from "@/lib/orders/zd-estimate-scope-facts";

describe("buildZdEstimateScopeFactParts", () => {
  it("bierze bogatsze „Holtrade / ACETAL” zamiast dublować ACETAL + Holtrade/ACETAL", () => {
    const parts = buildZdEstimateScopeFactParts({
      scopeName: "ACETAL",
      stockLabel: "1 miesiąc",
      dniZapasu: "30",
      supplierLabel: "Holtrade / ACETAL",
      dataOd: "2026-07-16",
      dataDo: "2026-08-14",
    });
    expect(parts.primary).toBe("Holtrade / ACETAL");
    expect(parts.supplier).toBeNull();
    expect(parts.stock).toBe("1 miesiąc · 30 d");
    expect(parts.window).toMatch(/16\.07\.2026/);
    expect(parts.window).toMatch(/14\.08\.2026/);
  });

  it("ukrywa dostawcę gdy zakres już go zawiera", () => {
    const parts = buildZdEstimateScopeFactParts({
      scopeName: "Holtrade / ACETAL",
      stockLabel: "1 miesiąc",
      dniZapasu: "30",
      supplierLabel: "Holtrade",
      dataOd: "2026-07-16",
      dataDo: "2026-08-14",
    });
    expect(parts.primary).toBe("Holtrade / ACETAL");
    expect(parts.supplier).toBeNull();
  });

  it("pokazuje osobnego dostawcę obok zakresu", () => {
    const parts = buildZdEstimateScopeFactParts({
      scopeName: "ACETAL",
      stockLabel: null,
      dniZapasu: "30",
      supplierLabel: "Holtrade",
      dataOd: "2026-07-16",
      dataDo: "2026-08-14",
    });
    expect(parts.primary).toBe("ACETAL");
    expect(parts.supplier).toBe("Holtrade");
    expect(parts.stock).toBe("30 d zapasu");
    expect(parts.summaryTitle).toMatch(/dostawca Holtrade/);
  });
});

describe("zdEstimateSupplierFactIsRedundant", () => {
  it("oznacza pokrywające się etykiety", () => {
    expect(zdEstimateSupplierFactIsRedundant("Holtrade", "Holtrade")).toBe(true);
    expect(
      zdEstimateSupplierFactIsRedundant("ACETAL", "Holtrade / ACETAL")
    ).toBe(true);
    expect(zdEstimateSupplierFactIsRedundant("ACETAL", "Holtrade")).toBe(false);
  });
});
