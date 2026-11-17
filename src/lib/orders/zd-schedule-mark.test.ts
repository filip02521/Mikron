import { describe, expect, it } from "vitest";
import { isZdPlanDueForMark, zdDefaultOrderKind, zdPlanStepDecision } from "./zd-schedule-mark";

describe("plan dostawcy na koniec Kreatora", () => {
  it("plan „na teraz”: dziś, zaległy albo bez daty", () => {
    expect(isZdPlanDueForMark("2026-11-09", "2026-11-09")).toBe(true);
    expect(isZdPlanDueForMark("2026-11-02", "2026-11-09")).toBe(true);
    expect(isZdPlanDueForMark(null, "2026-11-09")).toBe(true);
    expect(isZdPlanDueForMark("2026-11-13T00:00:00", "2026-11-09")).toBe(false);
  });

  it("domyślnie główne przy planie na teraz, uzupełniające przy przyszłym terminie albo bez planu", () => {
    expect(zdDefaultOrderKind({ scheduleCanMark: true, scheduleDue: true })).toBe("main");
    expect(zdDefaultOrderKind({ scheduleCanMark: true, scheduleDue: false })).toBe("side");
    expect(zdDefaultOrderKind({ scheduleCanMark: false, scheduleDue: true })).toBe("side");
  });

  it("główne przesuwa plan zawsze, gdy dostawca ma plan; uzupełniające nigdy; raz zapisany nie wraca", () => {
    expect(zdPlanStepDecision({ orderKind: "main", scheduleDone: false, scheduleCanMark: true })).toBe("mark");
    expect(zdPlanStepDecision({ orderKind: "main", scheduleDone: false, scheduleCanMark: false })).toBe("cannot_mark");
    expect(zdPlanStepDecision({ orderKind: "side", scheduleDone: false, scheduleCanMark: true })).toBe("side_keeps_plan");
    expect(zdPlanStepDecision({ orderKind: "side", scheduleDone: true, scheduleCanMark: true })).toBe("already_done");
  });
});
