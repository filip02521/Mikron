import { describe, expect, it } from "vitest";
import {
  dailyPanelQueueShellClass,
  formatDailyPanelCount,
} from "@/components/summary/DailyPanelSubsectionBar";

describe("dailyPanelQueueShellClass", () => {
  it("uses neutral shell for all queue tones", () => {
    expect(dailyPanelQueueShellClass("overdue")).toContain("border-slate-200");
    expect(dailyPanelQueueShellClass("prosby")).not.toContain("border-l-4");
    expect(dailyPanelQueueShellClass("today")).not.toContain("ring-1");
  });
});

describe("formatDailyPanelCount", () => {
  const grupy = { one: "grupa", few: "grupy", many: "grup" };

  it("pluralizes groups", () => {
    expect(formatDailyPanelCount(1, grupy)).toBe("1 grupa");
    expect(formatDailyPanelCount(4, grupy)).toBe("4 grupy");
    expect(formatDailyPanelCount(5, grupy)).toBe("5 grup");
  });
});
