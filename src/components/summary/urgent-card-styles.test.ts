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

  it("ton overdue — amber w karcie, linku i footerze", () => {
    expect(urgentCardClassName("overdue")).toContain("amber");
    expect(urgentSupplierNameLinkClass("overdue")).toContain("amber");
    expect(urgentFooterShellClass("overdue")).toContain("amber");
    expect(urgentFooterPrimaryClass("overdue")).toContain("amber-600");
  });

  it("ton today — sky / indigo", () => {
    expect(urgentCardClassName("today")).toContain("sky");
    expect(urgentSupplierNameLinkClass("today")).toContain("sky");
    expect(urgentFooterShellClass("today")).toContain("sky");
    expect(urgentFooterPrimaryClass("today")).toContain("indigo-600");
  });

  it("akceptuje legacy boolean w urgentCardClassName", () => {
    expect(urgentCardClassName(true)).toContain("amber");
    expect(urgentCardClassName(false)).toContain("sky");
  });

  it("trailing meta — Dziś zamiast badge Na dziś", () => {
    const today = buildUrgentScheduleDateMeta({
      tone: "today",
      dateLabel: "25.08",
    });
    expect(today.caption).toBe("Termin");
    expect(today.label).toBe("Dziś");
    expect(today.title).toContain("25.08");
    expect(today.labelClass).toContain("sky");
  });

  it("trailing meta — zaległe pokazuje datę", () => {
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
