import { describe, expect, it } from "vitest";
import { formatPlDate, formatStockPeriod, formatStockPeriodCompact } from "./display-labels";

describe("formatPlDate", () => {
  it("formatuje yyyy-MM-dd", () => {
    expect(formatPlDate("2026-05-12")).toBe("12.05.2026");
  });

  it("formatuje pełny timestamp ISO", () => {
    expect(formatPlDate("2026-05-11T22:00:00+00:00")).toBe("12.05.2026");
  });
});

describe("formatStockPeriodCompact", () => {
  it("zwraca okres bez prefiksu Zapas na", () => {
    expect(formatStockPeriodCompact("2 MIESIĄCE", null)).toBe("2 mies.");
    expect(formatStockPeriod("2 MIESIĄCE", null)).toBe("Zapas na 2 mies.");
  });

  it("obsługuje w razie potrzeby", () => {
    expect(formatStockPeriodCompact("W RAZIE POTRZEBY", null)).toBe("w razie potrzeby");
    expect(formatStockPeriod("W RAZIE POTRZEBY", null)).toBe("W razie potrzeby");
  });

  it("fallback do stockWeeks gdy brak raw", () => {
    expect(formatStockPeriodCompact(null, 6)).toBe("6 tyg.");
  });
});
