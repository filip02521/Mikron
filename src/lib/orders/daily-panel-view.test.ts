import { describe, expect, it } from "vitest";
import { dailyPanelViewLabel, parseDailyPanelView } from "./daily-panel-view";

describe("daily panel view", () => {
  it("parsuje view z URL", () => {
    expect(parseDailyPanelView("tydzien")).toBe("tydzien");
    expect(parseDailyPanelView("wyjatki")).toBe("wyjatki");
    expect(parseDailyPanelView("narzedzia")).toBe("wyjatki");
    expect(parseDailyPanelView(null)).toBe("dzis");
    expect(parseDailyPanelView("invalid")).toBe("dzis");
  });

  it("etykiety zakładek", () => {
    expect(dailyPanelViewLabel("dzis")).toBe("Dziś");
    expect(dailyPanelViewLabel("tydzien")).toBe("Tydzień");
    expect(dailyPanelViewLabel("wyjatki")).toBe("Wyjątki");
  });
});
