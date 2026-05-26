import { describe, expect, it } from "vitest";
import { dailyPanelQueueShellClass } from "@/components/summary/DailyPanelSubsectionBar";

describe("dailyPanelQueueShellClass", () => {
  it("maps tones to distinct left accents", () => {
    expect(dailyPanelQueueShellClass("overdue")).toContain("border-l-amber-500");
    expect(dailyPanelQueueShellClass("prosby")).toContain("border-l-indigo-500");
    expect(dailyPanelQueueShellClass("today")).toContain("border-l-sky-500");
  });
});
