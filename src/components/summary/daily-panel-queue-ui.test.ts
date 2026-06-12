import { describe, expect, it } from "vitest";
import {
  dailyPanelQueueShellClass,
  formatDailyPanelCount,
} from "@/components/summary/DailyPanelSubsectionBar";
import { dailyPanelCardRowClass } from "@/components/summary/daily-panel-list-styles";
import { urgentCardClassName } from "@/components/summary/urgent-card-styles";

describe("dailyPanelQueueShellClass", () => {
  it("uses tone tints without left accent stripes", () => {
    expect(dailyPanelQueueShellClass("overdue")).toContain("border-amber");
    expect(dailyPanelQueueShellClass("prosby")).toContain("border-indigo");
    expect(dailyPanelQueueShellClass("today")).toContain("border-sky");
    expect(dailyPanelQueueShellClass("cancel")).toContain("bg-amber-50");
    expect(dailyPanelQueueShellClass("plan")).toContain("bg-indigo-50");
    expect(dailyPanelQueueShellClass("informacja")).toContain("bg-sky-50");
    expect(dailyPanelQueueShellClass("stockOut")).toContain("border-amber");

    for (const tone of [
      "overdue",
      "prosby",
      "today",
      "cancel",
      "plan",
      "informacja",
      "stockOut",
    ] as const) {
      const shell = dailyPanelQueueShellClass(tone);
      expect(shell).not.toMatch(/border-l-\[3px\]/);
      expect(shell).not.toMatch(/border-l-(amber|indigo|sky|violet)-/);
    }
  });
});

describe("daily panel row cards", () => {
  it("avoid left accent stripes on list and urgent cards", () => {
    for (const cls of [
      urgentCardClassName(false),
      urgentCardClassName(true),
      dailyPanelCardRowClass("sky"),
      dailyPanelCardRowClass("amber"),
    ]) {
      expect(cls).not.toMatch(/border-l-\[3px\]/);
      expect(cls).not.toMatch(/border-l-(amber|indigo|sky|violet)-/);
    }
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
