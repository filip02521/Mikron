import { describe, expect, it } from "vitest";
import {
  computeDailyUrgentProgress,
  mergeUrgentBaseline,
} from "./daily-urgent-progress";

describe("daily urgent progress", () => {
  it("liczy zrobione i procent", () => {
    expect(computeDailyUrgentProgress(8, 3)).toEqual({
      total: 8,
      done: 5,
      remaining: 3,
      percent: 63,
      complete: false,
      hasWork: true,
    });
  });

  it("oznacza domknięcie gdy lista pusta", () => {
    const p = computeDailyUrgentProgress(5, 0);
    expect(p.complete).toBe(true);
    expect(p.percent).toBe(100);
    expect(p.done).toBe(5);
  });

  it("bez baseline używa bieżącej liczby", () => {
    expect(computeDailyUrgentProgress(null, 4).total).toBe(4);
    expect(computeDailyUrgentProgress(null, 0).hasWork).toBe(false);
  });

  it("podbija baseline gdy przybywa zaległych", () => {
    expect(mergeUrgentBaseline(8, 10)).toBe(10);
    expect(mergeUrgentBaseline(8, 3)).toBe(8);
    expect(mergeUrgentBaseline(null, 0)).toBe(null);
    expect(mergeUrgentBaseline(null, 2)).toBe(2);
  });
});
