import { describe, expect, it } from "vitest";
import {
  buildZdBomSeedQtyMap,
  formatZdBomComponentQtyLabel,
  normalizeZdBomComponentQty,
  parseZdBomComponentQtyOrNull,
} from "./zd-estimate-bom-qty";

describe("zd-estimate-bom-qty", () => {
  it("normalize — puste / ujemne → 1, 2× płyn → 2", () => {
    expect(normalizeZdBomComponentQty("")).toBe(1);
    expect(normalizeZdBomComponentQty("  ")).toBe(1);
    expect(normalizeZdBomComponentQty(0)).toBe(1);
    expect(normalizeZdBomComponentQty(-3)).toBe(1);
    expect(normalizeZdBomComponentQty("2")).toBe(2);
    expect(normalizeZdBomComponentQty(2.9)).toBe(2);
    expect(normalizeZdBomComponentQty(999_999)).toBe(100_000);
  });

  it("parseOrNull — ścisła walidacja jak w upsert", () => {
    expect(parseZdBomComponentQtyOrNull(2)).toBe(2);
    expect(parseZdBomComponentQtyOrNull(0)).toBeNull();
    expect(parseZdBomComponentQtyOrNull("x")).toBeNull();
    expect(parseZdBomComponentQtyOrNull(100_001)).toBeNull();
  });

  it("format label", () => {
    expect(formatZdBomComponentQtyLabel(1)).toBe("1 szt.");
    expect(formatZdBomComponentQtyLabel(2)).toBe("2 szt.");
  });

  it("buildZdBomSeedQtyMap — domyślnie 1, zachowuje poprawne previous", () => {
    expect(buildZdBomSeedQtyMap([10, 20])).toEqual({ 10: "1", 20: "1" });
    expect(
      buildZdBomSeedQtyMap([10, 20], { 10: "2", 20: "", 30: "9" })
    ).toEqual({ 10: "2", 20: "1" });
    expect(buildZdBomSeedQtyMap([10], { 10: "2.9" })).toEqual({ 10: "2" });
  });
});
