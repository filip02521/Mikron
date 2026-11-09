import { describe, expect, it } from "vitest";
import { isZdPlanDueForMark, zdPlanStepDecision } from "./zd-schedule-mark";

describe("plan dostawcy na koniec Kreatora", () => {
  it("do oznaczenia tylko plan dziś, zaległy albo bez daty", () => {
    expect(isZdPlanDueForMark("2026-11-09", "2026-11-09")).toBe(true);
    expect(isZdPlanDueForMark("2026-11-02", "2026-11-09")).toBe(true);
    expect(isZdPlanDueForMark(null, "2026-11-09")).toBe(true);
    expect(isZdPlanDueForMark("2026-11-13T00:00:00", "2026-11-09")).toBe(false);
  });

  it("główne przesuwa plan, gdy wolno; poboczne nigdy; raz zapisany nie wraca", () => {
    expect(zdPlanStepDecision({ orderKind: "main", scheduleDone: false, scheduleCanMark: true })).toBe("mark");
    expect(zdPlanStepDecision({ orderKind: "main", scheduleDone: false, scheduleCanMark: false })).toBe("cannot_mark");
    expect(zdPlanStepDecision({ orderKind: "side", scheduleDone: false, scheduleCanMark: true })).toBe("side_keeps_plan");
    expect(zdPlanStepDecision({ orderKind: "side", scheduleDone: true, scheduleCanMark: true })).toBe("already_done");
  });
});
