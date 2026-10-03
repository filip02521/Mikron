import { describe, expect, it } from "vitest";
import {
  buildUrgentScheduleDateMeta,
  urgentCardClassName,
  urgentCardTone,
  urgentFooterPrimaryClass,
  urgentFooterShellClass,
  urgentSupplierNameLinkClass,
} from "./urgent-card-styles";

describe("urgent-card-styles", () => {
  it("mapuje boolean na ton", () => {
    expect(urgentCardTone(true)).toBe("overdue");
    expect(urgentCardTone(false)).toBe("today");
  });

  it("karta, link i footer są neutralne; primary zawsze w akcencie marki", () => {
    for (const tone of ["overdue", "today", true, false] as const) {
      expect(urgentCardClassName(tone)).not.toMatch(/amber|sky/);
    }
    for (const tone of ["overdue", "today"] as const) {
      expect(urgentSupplierNameLinkClass(tone)).not.toMatch(/amber|sky/);
      expect(urgentFooterShellClass(tone)).not.toMatch(/amber|sky/);
      expect(urgentFooterPrimaryClass(tone)).toContain("indigo-600");
    }
  });

  it("trailing meta - Dziś zamiast badge Na dziś", () => {
    const today = buildUrgentScheduleDateMeta({
      tone: "today",
      dateLabel: "25.08",
    });
    expect(today.caption).toBe("Termin");
    expect(today.label).toBe("Dziś");
    expect(today.title).toContain("25.08");
    expect(today.labelClass).toContain("sky");
  });

  it("trailing meta - zaległe pokazuje datę", () => {
    const overdue = buildUrgentScheduleDateMeta({
      tone: "overdue",
      dateLabel: "12.03",
    });
    expect(overdue.caption).toBe("Termin");
    expect(overdue.label).toBe("12.03");
    expect(overdue.title).toContain("12.03");
    expect(overdue.labelClass).toContain("amber");
  });
});
