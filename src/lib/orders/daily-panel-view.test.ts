import { describe, expect, it } from "vitest";
import {
  dailyPanelIntroDescription,
  dailyPanelViewLabel,
  parseDailyPanelView,
} from "./daily-panel-view";

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

  it("opis panelu zależy od zakładki", () => {
    expect(dailyPanelIntroDescription("dzis", { includeShortcuts: false })).toContain(
      "zaległe"
    );
    expect(dailyPanelIntroDescription("tydzien", { includeShortcuts: false })).toContain(
      "Plan zamówień"
    );
    expect(dailyPanelIntroDescription("wyjatki", { includeShortcuts: false })).toContain(
      "Informacja"
    );
    expect(dailyPanelIntroDescription("dzis")).not.toContain("Skróty:");
    expect(dailyPanelIntroDescription("dzis", { includeShortcuts: true })).toContain("Skróty:");
  });
});
