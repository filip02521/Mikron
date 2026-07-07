import { describe, it, expect } from "vitest";
import {
  validateInlineSpec,
  validateCount,
  colorOptions,
  mouldOptions,
  jawOptions,
  kindOptions,
  buildSpecGroups,
} from "./teeth-verification-inline";

describe("validateInlineSpec", () => {
  it("accepts valid color for wiedent_estetic", () => {
    const result = validateInlineSpec({ color: "A2" }, "wiedent_estetic");
    expect(result.ok).toBe(true);
  });

  it("rejects invalid color", () => {
    const result = validateInlineSpec({ color: "ZZ99" }, "wiedent_estetic");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("nie istnieje");
  });

  it("accepts valid mould for posterior", () => {
    const result = validateInlineSpec({ mould: "60", kind: "posterior" }, "wiedent_estetic");
    expect(result.ok).toBe(true);
  });

  it("rejects mould not in catalog for given kind", () => {
    const result = validateInlineSpec({ mould: "FAKE", kind: "posterior" }, "wiedent_estetic");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("nie istnieje");
  });

  it("requires jaw for posterior", () => {
    const result = validateInlineSpec({ jaw: null, kind: "posterior" }, "wiedent_estetic");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("Szczęka");
  });

  it("accepts null jaw for anterior", () => {
    const result = validateInlineSpec({ jaw: null, kind: "anterior" }, "wiedent_estetic");
    expect(result.ok).toBe(true);
  });

  it("rejects invalid kind", () => {
    const result = validateInlineSpec({ kind: "lateral" }, "wiedent_estetic");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("Typ");
  });

  it("accepts empty patch", () => {
    const result = validateInlineSpec({}, "wiedent_estetic");
    expect(result.ok).toBe(true);
  });
});

describe("validateCount", () => {
  it("accepts valid count", () => {
    expect(validateCount(1).ok).toBe(true);
    expect(validateCount(50).ok).toBe(true);
    expect(validateCount(200).ok).toBe(true);
  });

  it("rejects zero", () => {
    expect(validateCount(0).ok).toBe(false);
  });

  it("rejects negative", () => {
    expect(validateCount(-1).ok).toBe(false);
  });

  it("rejects over 200", () => {
    expect(validateCount(201).ok).toBe(false);
  });

  it("rejects non-integer", () => {
    expect(validateCount(1.5).ok).toBe(false);
    expect(validateCount(NaN).ok).toBe(false);
  });
});

describe("colorOptions", () => {
  it("returns array of colors for line", () => {
    const colors = colorOptions("wiedent_estetic");
    expect(colors.length).toBeGreaterThan(0);
    expect(colors).toContain("A2");
  });
});

describe("mouldOptions", () => {
  it("returns moulds for posterior kind", () => {
    const moulds = mouldOptions("wiedent_estetic", "posterior");
    expect(moulds.length).toBeGreaterThan(0);
  });

  it("returns moulds for anterior kind", () => {
    const moulds = mouldOptions("wiedent_estetic", "anterior");
    expect(moulds.length).toBeGreaterThan(0);
  });

  it("includes null option for lines with optionalMould", () => {
    const moulds = mouldOptions("hansen_generic", "anterior");
    expect(moulds).toContain(null);
  });
});

describe("jawOptions", () => {
  it("returns upper/lower for posterior", () => {
    const opts = jawOptions("posterior");
    expect(opts).toHaveLength(2);
    expect(opts.find((o) => o.value === "upper")).toBeDefined();
    expect(opts.find((o) => o.value === "lower")).toBeDefined();
  });

  it("returns dash for anterior", () => {
    const opts = jawOptions("anterior");
    expect(opts).toHaveLength(1);
    expect(opts[0].value).toBeNull();
  });

  it("returns dash for null kind", () => {
    const opts = jawOptions(null);
    expect(opts).toHaveLength(1);
    expect(opts[0].value).toBeNull();
  });
});

describe("kindOptions", () => {
  it("returns anterior and posterior", () => {
    const opts = kindOptions();
    expect(opts).toHaveLength(2);
    expect(opts.find((o) => o.value === "anterior")).toBeDefined();
    expect(opts.find((o) => o.value === "posterior")).toBeDefined();
  });
});

describe("buildSpecGroups", () => {
  it("groups identical specs", () => {
    const groups = buildSpecGroups([
      { color: "A2", mould: "12", jaw: null, kind: "anterior", ordered_at: null },
      { color: "A2", mould: "12", jaw: null, kind: "anterior", ordered_at: null },
      { color: "A2", mould: "12", jaw: null, kind: "anterior", ordered_at: null },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].count).toBe(3);
    expect(groups[0].hasOrdered).toBe(false);
  });

  it("separates different specs", () => {
    const groups = buildSpecGroups([
      { color: "A2", mould: "12", jaw: null, kind: "anterior", ordered_at: null },
      { color: "A3", mould: "12", jaw: null, kind: "anterior", ordered_at: null },
    ]);
    expect(groups).toHaveLength(2);
  });

  it("separates by jaw", () => {
    const groups = buildSpecGroups([
      { color: "A2", mould: "60", jaw: "upper", kind: "posterior", ordered_at: null },
      { color: "A2", mould: "60", jaw: "lower", kind: "posterior", ordered_at: null },
    ]);
    expect(groups).toHaveLength(2);
  });

  it("marks hasOrdered when any item has ordered_at", () => {
    const groups = buildSpecGroups([
      { color: "A2", mould: "12", jaw: null, kind: "anterior", ordered_at: null },
      { color: "A2", mould: "12", jaw: null, kind: "anterior", ordered_at: "2024-01-01" },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].hasOrdered).toBe(true);
  });

  it("handles empty array", () => {
    expect(buildSpecGroups([])).toEqual([]);
  });

  it("handles null mould", () => {
    const groups = buildSpecGroups([
      { color: "A2", mould: null, jaw: null, kind: "anterior", ordered_at: null },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].mould).toBeNull();
  });
});
