import { describe, it, expect } from "vitest";
import { resolveSupplierForTeethPrefill, buildTeethOcrProsbaLines } from "./teeth-ocr-prosba-prefill";
import type { ProductLineDraft } from "@/components/orders/request-product-lines";
import type { TeethOcrGroup } from "@/components/teeth/TeethOcrWizard";

const suppliers = [
  { id: "sup-wiedent", name: "Wiedent" },
  { id: "sup-ivoclar", name: "Ivoclar" },
  { id: "sup-major", name: "Major Dental" },
  { id: "sup-other", name: "Inny Dostawca" },
];

const baseLine = (overrides: Partial<ProductLineDraft>): ProductLineDraft => ({
  id: "test-id",
  symbol: "",
  mikranCode: "",
  product: "Test",
  quantity: "1",
  ...overrides,
});

describe("resolveSupplierForTeethPrefill", () => {
  it("returns empty string when no suppliers", () => {
    const lines = [baseLine({ teethManufacturer: "wiedent" })];
    expect(resolveSupplierForTeethPrefill(lines, [])).toBe("");
  });

  it("returns empty string when no teeth manufacturer on lines", () => {
    const lines = [baseLine({ teethManufacturer: null })];
    expect(resolveSupplierForTeethPrefill(lines, suppliers)).toBe("");
  });

  it("matches Wiedent manufacturer to Wiedent supplier", () => {
    const lines = [baseLine({ teethManufacturer: "wiedent" })];
    expect(resolveSupplierForTeethPrefill(lines, suppliers)).toBe("sup-wiedent");
  });

  it("matches Ivoclar manufacturer to Ivoclar supplier", () => {
    const lines = [baseLine({ teethManufacturer: "ivoclar" })];
    expect(resolveSupplierForTeethPrefill(lines, suppliers)).toBe("sup-ivoclar");
  });

  it("matches Major manufacturer to Major Dental supplier", () => {
    const lines = [baseLine({ teethManufacturer: "major" })];
    expect(resolveSupplierForTeethPrefill(lines, suppliers)).toBe("sup-major");
  });

  it("returns first match when multiple manufacturers present", () => {
    const lines = [
      baseLine({ teethManufacturer: "wiedent" }),
      baseLine({ teethManufacturer: "ivoclar" }),
    ];
    const result = resolveSupplierForTeethPrefill(lines, suppliers);
    expect(["sup-wiedent", "sup-ivoclar"]).toContain(result);
  });

  it("returns empty string when no supplier name matches", () => {
    const lines = [baseLine({ teethManufacturer: "formed" })];
    expect(resolveSupplierForTeethPrefill(lines, suppliers)).toBe("");
  });
});

describe("buildTeethOcrProsbaLines", () => {
  it("separates groups by productLine and kind", () => {
    const groups: TeethOcrGroup[] = [
      { id: "g1", productLine: "wiedent_estetic", kind: "anterior", color: "G1", mould: "21", jaw: null, count: 2 },
      { id: "g2", productLine: "wiedent_estetic", kind: "anterior", color: "G1", mould: "42", jaw: null, count: 1 },
      { id: "g3", productLine: "ivoclar_ivostar", kind: "anterior", color: "2B", mould: "01", jaw: null, count: 1 },
      { id: "g4", productLine: "ivoclar_gnathostar", kind: "posterior", color: "2B", mould: "D84", jaw: "upper", count: 1 },
    ];

    const lines = buildTeethOcrProsbaLines(groups, null);
    expect(lines.length).toBe(3);

    const wiedentLine = lines.find((l) => l.teethProductLine === "wiedent_estetic");
    expect(wiedentLine).toBeDefined();
    expect(wiedentLine?.teethKind).toBe("anterior");
    expect(wiedentLine?.quantity).toBe("3");
    expect(wiedentLine?.teethDetails?.length).toBe(3);

    const ivostarLine = lines.find((l) => l.teethProductLine === "ivoclar_ivostar");
    expect(ivostarLine).toBeDefined();
    expect(ivostarLine?.teethKind).toBe("anterior");
    expect(ivostarLine?.quantity).toBe("1");

    const gnathostarLine = lines.find((l) => l.teethProductLine === "ivoclar_gnathostar");
    expect(gnathostarLine).toBeDefined();
    expect(gnathostarLine?.teethKind).toBe("posterior");
    expect(gnathostarLine?.quantity).toBe("1");
  });

  it("sets teethManufacturer on each line", () => {
    const groups: TeethOcrGroup[] = [
      { id: "g1", productLine: "wiedent_estetic", kind: "anterior", color: "G1", mould: "21", jaw: null, count: 1 },
      { id: "g2", productLine: "major_super_lux", kind: "posterior", color: "A3", mould: "0/8", jaw: "upper", count: 1 },
    ];

    const lines = buildTeethOcrProsbaLines(groups, null);
    expect(lines.find((l) => l.teethManufacturer === "wiedent")).toBeDefined();
    expect(lines.find((l) => l.teethManufacturer === "major")).toBeDefined();
  });
});
