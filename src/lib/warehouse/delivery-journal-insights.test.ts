import { describe, expect, it } from "vitest";
import {
  assertJournalSearchRange,
  deliveryJournalPresetRange,
} from "@/lib/warehouse/delivery-journal-insights";

describe("deliveryJournalPresetRange", () => {
  it("returns single day for today preset", () => {
    const ref = new Date("2026-05-28T10:00:00Z");
    const { dateFrom, dateTo } = deliveryJournalPresetRange("today", ref);
    expect(dateFrom).toBe(dateTo);
    expect(dateFrom).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("week preset starts on Monday", () => {
    const ref = new Date("2026-05-28T10:00:00Z");
    const { dateFrom, dateTo } = deliveryJournalPresetRange("week", ref);
    expect(dateFrom <= dateTo).toBe(true);
    const monday = new Date(`${dateFrom}T12:00:00`);
    expect(monday.getDay()).toBe(1);
  });
});

describe("assertJournalSearchRange", () => {
  it("rejects ranges over 93 days", () => {
    expect(() => assertJournalSearchRange("2026-01-01", "2026-05-01")).toThrow(/93/);
  });
});
