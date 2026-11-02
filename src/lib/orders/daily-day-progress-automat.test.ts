import { describe, expect, it } from "vitest";
import { buildDailyDayProgress, withAutomatDayProgress } from "./daily-day-progress";

describe("withAutomatDayProgress", () => {
  const base = buildDailyDayProgress(4, 3, 2, 2); // harmonogram 1/4, prośby 0/2
  it("dokłada zamówienia automatu do postępu dnia", () => {
    const p = withAutomatDayProgress(base, { done: 1, total: 2 });
    expect(p.automat).toMatchObject({ done: 1, total: 2, remaining: 1 });
    expect(p.combined).toMatchObject({ total: 8, done: 2, remaining: 6, percent: 25, complete: false });
  });
  it("bez zamówień automatu — postęp bez zmian", () => {
    expect(withAutomatDayProgress(base, null)).toBe(base);
    expect(withAutomatDayProgress(base, { done: 0, total: 0 })).toBe(base);
  });
  it("sam automat domyka dzień, gdy harmonogramu i próśb nie ma", () => {
    const p = withAutomatDayProgress(buildDailyDayProgress(null, 0, null, 0), { done: 2, total: 2 });
    expect(p.hasWork).toBe(true);
    expect(p.complete).toBe(true);
  });
});
