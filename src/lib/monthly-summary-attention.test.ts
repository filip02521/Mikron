import { describe, expect, it } from "vitest";
import { monthlySummaryNeedsAttention } from "./monthly-summary-attention";

describe("monthlySummaryNeedsAttention", () => {
  it("true w pierwszych 7 dniach gdy miesiąc jeszcze nie obejrzany", () => {
    const at = new Date("2026-08-03T12:00:00+02:00");
    expect(monthlySummaryNeedsAttention(at, null)).toBe(true);
    expect(monthlySummaryNeedsAttention(at, "2026-06")).toBe(true);
  });

  it("false po obejrzeniu bieżącego cyklu lub poza oknem 7 dni", () => {
    const early = new Date("2026-08-03T12:00:00+02:00");
    expect(monthlySummaryNeedsAttention(early, "2026-07")).toBe(false);
    const late = new Date("2026-08-10T12:00:00+02:00");
    expect(monthlySummaryNeedsAttention(late, null)).toBe(false);
  });
});
