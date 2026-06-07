import { describe, expect, it } from "vitest";
import { formatStockPeriod, formatStockPeriodCompact } from "./display-labels";

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
