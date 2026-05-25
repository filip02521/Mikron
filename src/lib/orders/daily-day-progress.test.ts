import { describe, expect, it } from "vitest";
import { buildDailyDayProgress, combineDayProgress } from "./daily-day-progress";
import { computeDailyUrgentProgress } from "./daily-urgent-progress";

describe("daily day progress", () => {
  it("łączy segmenty harmonogramu i prośb", () => {
    const urgent = computeDailyUrgentProgress(4, 1);
    const forSomeone = computeDailyUrgentProgress(2, 2);
    const combined = combineDayProgress(urgent, forSomeone);
    expect(combined.total).toBe(6);
    expect(combined.done).toBe(3);
    expect(combined.remaining).toBe(3);
    expect(combined.percent).toBe(50);
  });

  it("buildDailyDayProgress z baseline", () => {
    const p = buildDailyDayProgress(5, 2, 3, 1);
    expect(p.urgent.remaining).toBe(2);
    expect(p.forSomeone.remaining).toBe(1);
    expect(p.combined.total).toBe(8);
    expect(p.hasWork).toBe(true);
  });
});
