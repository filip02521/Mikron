import { describe, expect, it } from "vitest";
import {
  classifyTeethShortageAvailability,
  teethShortageAvailabilityBadgeClass,
  teethShortageAvailabilityBadgeLabel,
  teethShortageAvailabilityMessage,
} from "./teeth-shortage-copy";
import {
  formatTeethShortageHitLabel,
  matchActiveTeethShortages,
  teethShortageVariantKey,
  type TeethShortageMatchInput,
} from "./teeth-shortage-match";

const baseShortage = (overrides: Partial<TeethShortageMatchInput> = {}): TeethShortageMatchInput => ({
  id: "sh1",
  supplierId: "sup1",
  supplierName: "Lab Test",
  productLine: "wiedent_estetic",
  color: "A1",
  mould: "12",
  kind: "anterior",
  availableFrom: "2026-08-15",
  note: "",
  active: true,
  ...overrides,
});

describe("teeth-shortage-copy", () => {
  it("classifies dated / undated / past", () => {
    expect(classifyTeethShortageAvailability("2026-08-15", "2026-07-01")).toBe("dated");
    expect(classifyTeethShortageAvailability(null, "2026-07-01")).toBe("undated");
    expect(classifyTeethShortageAvailability("2026-06-01", "2026-07-01")).toBe("past");
  });

  it("formats messages for each availability branch", () => {
    expect(teethShortageAvailabilityMessage("Lab X", "2026-08-15", "2026-07-01")).toContain(
      "dostępne od"
    );
    expect(teethShortageAvailabilityMessage("Lab X", null, "2026-07-01")).toContain(
      "nieustalony"
    );
    expect(teethShortageAvailabilityMessage("Lab X", "2026-06-01", "2026-07-01")).toContain(
      "minęła"
    );
    expect(teethShortageAvailabilityBadgeLabel(null)).toBe("Nieustalona");
  });

  it("styles availability badges by urgency", () => {
    expect(teethShortageAvailabilityBadgeClass(null, "2026-07-01")).toMatch(/amber/);
    expect(teethShortageAvailabilityBadgeClass("2026-06-01", "2026-07-01")).toMatch(/rose/);
    expect(teethShortageAvailabilityBadgeClass("2026-08-15", "2026-07-01")).toMatch(/slate/);
  });
});

describe("teeth-shortage-match", () => {
  it("builds stable variant keys", () => {
    expect(
      teethShortageVariantKey({
        productLine: "wiedent_estetic",
        color: " A1 ",
        mould: "12",
        kind: "anterior",
      })
    ).toBe("wiedent_estetic|a1|12|anterior");
  });

  it("matches color and mould case-insensitively", () => {
    const hits = matchActiveTeethShortages({
      productLine: "wiedent_estetic",
      details: [{ position: 1, color: "a1", mould: "12", kind: "anterior", jaw: "upper" }],
      shortages: [baseShortage()],
      todayKey: "2026-07-01",
    });
    expect(hits).toHaveLength(1);
    expect(hits[0]!.count).toBe(1);
  });

  it("ignores inactive shortages", () => {
    const hits = matchActiveTeethShortages({
      productLine: "wiedent_estetic",
      details: [{ position: 1, color: "A1", mould: "12", kind: "anterior" }],
      shortages: [baseShortage({ active: false })],
      todayKey: "2026-07-01",
    });
    expect(hits).toHaveLength(0);
  });

  it("requires kind when shortage specifies kind", () => {
    const hits = matchActiveTeethShortages({
      productLine: "wiedent_estetic",
      details: [{ position: 1, color: "A1", mould: "12", kind: "posterior" }],
      shortages: [baseShortage({ kind: "anterior" })],
      todayKey: "2026-07-01",
    });
    expect(hits).toHaveLength(0);
  });

  it("matches any kind when shortage kind is null", () => {
    const hits = matchActiveTeethShortages({
      productLine: "wiedent_estetic",
      details: [{ position: 1, color: "A1", mould: "12", kind: "posterior" }],
      shortages: [baseShortage({ kind: null })],
      todayKey: "2026-07-01",
    });
    expect(hits).toHaveLength(1);
  });

  it("aggregates counts and prefers form supplier", () => {
    const hits = matchActiveTeethShortages({
      productLine: "wiedent_estetic",
      supplierId: "sup1",
      details: [
        { position: 1, color: "A1", mould: "12", kind: "anterior" },
        { position: 2, color: "A1", mould: "12", kind: "anterior" },
      ],
      shortages: [
        baseShortage({ id: "a", supplierId: "sup1", supplierName: "Lab A" }),
        baseShortage({ id: "b", supplierId: "sup2", supplierName: "Lab B" }),
      ],
      todayKey: "2026-07-01",
    });
    expect(hits).toHaveLength(1);
    expect(hits[0]!.shortage.supplierId).toBe("sup1");
    expect(hits[0]!.count).toBe(2);
    expect(formatTeethShortageHitLabel(hits[0]!)).toContain("2×");
  });

  it("falls back to other labs when form supplier has no hit", () => {
    const hits = matchActiveTeethShortages({
      productLine: "wiedent_estetic",
      supplierId: "sup-other",
      details: [{ position: 1, color: "A1", mould: "12", kind: "anterior" }],
      shortages: [baseShortage()],
      todayKey: "2026-07-01",
    });
    expect(hits).toHaveLength(1);
    expect(hits[0]!.shortage.supplierName).toBe("Lab Test");
  });

  it("treats empty mould as match for lines without fason", () => {
    const hits = matchActiveTeethShortages({
      productLine: "hansen_generic",
      details: [{ position: 1, color: "A2", mould: null, kind: "anterior" }],
      shortages: [
        baseShortage({
          productLine: "hansen_generic",
          color: "A2",
          mould: "",
          kind: null,
        }),
      ],
      todayKey: "2026-07-01",
    });
    expect(hits).toHaveLength(1);
  });
});
