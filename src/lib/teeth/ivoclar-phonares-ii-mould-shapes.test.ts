import { describe, expect, it } from "vitest";
import {
  inferIvoclarPhonaresIiShapeId,
  ivoclarPhonaresIiMouldShapeGroups,
  PHONARES_II_ANTERIOR_LOWER,
  PHONARES_II_POSTERIOR,
} from "./ivoclar-phonares-ii-mould-shapes";

describe("ivoclar-phonares-ii-mould-shapes", () => {
  it("grupuje przody na Bold / Soft / Dolne wg karty PDF", () => {
    const groups = ivoclarPhonaresIiMouldShapeGroups("anterior");
    expect(groups.map((g) => g.label)).toEqual(["Bold", "Soft", "Dolne"]);
    expect(groups[0]?.moulds).toContain("B71");
    expect(groups[1]?.moulds).toContain("S61");
    expect(groups[2]?.moulds).toEqual(PHONARES_II_ANTERIOR_LOWER);
    expect(groups[2]?.moulds).toContain("L54");
    expect(groups[2]?.moulds).toContain("L55");
  });

  it("grupuje boki na Typ i Lingual (góra/dół)", () => {
    const groups = ivoclarPhonaresIiMouldShapeGroups("posterior");
    expect(groups).toHaveLength(4);
    expect(groups.map((g) => g.label)).toEqual([
      "Typ górna",
      "Typ dolna",
      "Lingual górna",
      "Lingual dolna",
    ]);
    expect(groups[0]?.moulds).toContain("NU6");
    expect(groups[1]?.moulds).toContain("NL3");
    expect(groups[2]?.moulds).toContain("LU5");
    expect(groups[3]?.moulds).toContain("LL6");
  });

  it("inferIvoclarPhonaresIiShapeId mapuje serie", () => {
    expect(inferIvoclarPhonaresIiShapeId("S72")).toBe("oval");
    expect(inferIvoclarPhonaresIiShapeId("B83")).toBe("square");
    expect(inferIvoclarPhonaresIiShapeId("L55")).toBe("lower");
    expect(inferIvoclarPhonaresIiShapeId("NU3")).toBe("upper");
    expect(inferIvoclarPhonaresIiShapeId("LL5")).toBe("lower");
  });

  it("posterior palette obejmuje Typ i Lingual", () => {
    expect(PHONARES_II_POSTERIOR).toHaveLength(12);
    expect(PHONARES_II_POSTERIOR).toContain("LU3");
    expect(PHONARES_II_POSTERIOR).toContain("LL6");
  });
});
