import { describe, expect, it } from "vitest";
import {
  currentMonthKeyFromDate,
  defaultMonthlySummaryMonthKey,
  isCompletedMonthlySummaryMonth,
  isMonthlySummaryAvailable,
  monthLabelFromKey,
  previousMonthKeyFromDate,
  resolveCompletedMonthlySummaryMonthKey,
} from "./monthly-stats-shared";

describe("monthly-stats-shared month defaults", () => {
  it("previousMonthKeyFromDate cofa o miesiąc (w tym przez rok)", () => {
    expect(previousMonthKeyFromDate(new Date("2026-08-01T12:00:00+02:00"))).toBe("2026-07");
    expect(previousMonthKeyFromDate(new Date("2026-01-05T12:00:00+01:00"))).toBe("2025-12");
  });

  it("defaultMonthlySummaryMonthKey wskazuje miniony miesiąc", () => {
    expect(defaultMonthlySummaryMonthKey(new Date("2026-08-01T10:00:00+02:00"))).toBe("2026-07");
    expect(monthLabelFromKey("2026-07")).toContain("lipiec");
  });

  it("isMonthlySummaryAvailable tylko w pierwszych 7 dniach miesiąca (Warszawa)", () => {
    expect(isMonthlySummaryAvailable(new Date("2026-08-01T12:00:00+02:00"))).toBe(true);
    expect(isMonthlySummaryAvailable(new Date("2026-08-07T12:00:00+02:00"))).toBe(true);
    expect(isMonthlySummaryAvailable(new Date("2026-08-08T12:00:00+02:00"))).toBe(false);
  });

  it("bieżący miesiąc nie jest uważany za pełne podsumowanie", () => {
    const at = new Date("2026-08-01T12:00:00+02:00");
    expect(currentMonthKeyFromDate(at)).toBe("2026-08");
    expect(isCompletedMonthlySummaryMonth("2026-08", at)).toBe(false);
    expect(isCompletedMonthlySummaryMonth("2026-07", at)).toBe(true);
  });

  it("resolveCompletedMonthlySummaryMonthKey odrzuca bieżący miesiąc z URL", () => {
    const at = new Date("2026-08-03T12:00:00+02:00");
    expect(resolveCompletedMonthlySummaryMonthKey("2026-08", at)).toBe("2026-07");
    expect(resolveCompletedMonthlySummaryMonthKey("2026-06", at)).toBe("2026-06");
    expect(resolveCompletedMonthlySummaryMonthKey(undefined, at)).toBe("2026-07");
  });
});
