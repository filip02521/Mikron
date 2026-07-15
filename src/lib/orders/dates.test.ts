import { describe, it, expect } from "vitest";
import {
  calculateNextOrderDate,
  calculateBusinessDays,
  calculateBusinessDate,
  parseInterval,
  parseIntervalWeeks,
  resolveSupplierInterval,
  intervalWeeksForStorage,
  correctWeekendDate,
  formatDateString,
} from "./dates";

describe("calculateNextOrderDate", () => {
  it("adds weeks and skips Saturday to Monday", () => {
    const base = new Date("2025-05-10T12:00:00"); // Saturday
    const result = calculateNextOrderDate(base, { unit: "weeks", value: 1 });
    expect(result?.getDay()).toBe(1); // Monday
  });

  it("skips Sunday to Monday", () => {
    const base = new Date("2025-05-04T12:00:00"); // Sunday
    const result = calculateNextOrderDate(base, { unit: "weeks", value: 1 });
    expect(result?.getDay()).not.toBe(0);
    expect(result?.getDay()).not.toBe(6);
  });

  it("adds calendar months (3 miesiące)", () => {
    const base = new Date("2026-01-08T12:00:00");
    const result = calculateNextOrderDate(base, { unit: "months", value: 3 });
    expect(formatDateString(result!)).toBe("2026-04-08");
  });

  it("adds 4 months from plain text parse", () => {
    const interval = parseInterval("4 MIESIĄCE");
    expect(interval).toEqual({ unit: "months", value: 4 });
    const base = new Date("2026-01-15T12:00:00");
    const result = calculateNextOrderDate(base, interval!);
    expect(formatDateString(result!)).toBe("2026-05-15");
  });
});

describe("parseInterval", () => {
  it("plain number = weeks", () => {
    expect(parseInterval("3")).toEqual({ unit: "weeks", value: 3 });
    expect(parseInterval(6)).toEqual({ unit: "weeks", value: 6 });
  });

  it("months text = months not weeks", () => {
    expect(parseInterval("3 MIESIĄCE")).toEqual({ unit: "months", value: 3 });
    expect(parseInterval("1 miesiąc")).toEqual({ unit: "months", value: 1 });
    expect(parseInterval("2 MIESIACE")).toEqual({ unit: "months", value: 2 });
  });

  it("rejects phone-like numbers", () => {
    expect(parseInterval("602344121")).toBeNull();
  });

  it("Co pół roku — 6 MIESIĘCY = 6 months", () => {
    expect(parseInterval("6 MIESIĘCY")).toEqual({ unit: "months", value: 6 });
    expect(parseInterval("6 miesięcy")).toEqual({ unit: "months", value: 6 });
  });

  it("Co kwartał — 3 MIESIĄCE = 3 months", () => {
    expect(parseInterval("3 MIESIĄCE")).toEqual({ unit: "months", value: 3 });
    expect(parseInterval("kwartał")).toEqual({ unit: "months", value: 3 });
  });

  it("Co miesiąc — 1 MIESIĄC = 1 month", () => {
    expect(parseInterval("1 MIESIĄC")).toEqual({ unit: "months", value: 1 });
  });

  it("pół roku (text) = 6 months", () => {
    expect(parseInterval("pół roku")).toEqual({ unit: "months", value: 6 });
    expect(parseInterval("PÓŁ ROKU")).toEqual({ unit: "months", value: 6 });
  });
});

describe("resolveSupplierInterval — full cycle", () => {
  it("6 MIESIĘCY: interval_weeks=null, resolves from raw", () => {
    const parsed = parseInterval("6 MIESIĘCY");
    const stored = intervalWeeksForStorage("6 MIESIĘCY", parsed);
    expect(stored).toBeNull();
    const resolved = resolveSupplierInterval("6 MIESIĘCY", stored);
    expect(resolved).toEqual({ unit: "months", value: 6 });
  });

  it("6 MIESIĘCY: next date is +6 months", () => {
    const interval = resolveSupplierInterval("6 MIESIĘCY", null);
    const base = new Date("2026-01-15T12:00:00");
    const next = calculateNextOrderDate(base, interval!);
    expect(formatDateString(next!)).toBe("2026-07-15");
  });

  it("empty raw + null weeks = null (no interval)", () => {
    expect(resolveSupplierInterval("", null)).toBeNull();
    expect(resolveSupplierInterval(null, null)).toBeNull();
  });

  it("empty raw + weeks fallback = weeks", () => {
    expect(resolveSupplierInterval("", 4)).toEqual({ unit: "weeks", value: 4 });
  });
});

describe("parseIntervalWeeks", () => {
  it("returns weeks for numeric", () => {
    expect(parseIntervalWeeks(2)).toBe(2);
  });
});

describe("calculateBusinessDays", () => {
  it("counts weekdays only across a weekend", () => {
    const start = new Date("2025-05-12"); // Mon
    const end = new Date("2025-05-19"); // Mon
    expect(calculateBusinessDays(start, end)).toBe(5);
  });
});

describe("calculateBusinessDate", () => {
  it("adds business days skipping weekend", () => {
    const start = new Date("2025-05-09"); // Friday
    const result = calculateBusinessDate(start, 1);
    expect(result.getDay()).toBe(1); // Monday
  });
});

describe("correctWeekendDate", () => {
  it("moves Saturday to Monday", () => {
    const sat = new Date("2025-05-10");
    const result = correctWeekendDate(sat);
    expect(result.getDay()).toBe(1);
  });
});
