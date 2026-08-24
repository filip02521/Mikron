import { describe, expect, it } from "vitest";
import {
  dailyPanelVacationNoticeCtaLabel,
  dailyPanelVacationNoticeHint,
  dailyPanelVacationNoticeTitle,
} from "@/lib/orders/daily-panel-vacation-notice-copy";

describe("dailyPanelVacationNoticeTitle", () => {
  it("odmienia dostawcę", () => {
    expect(dailyPanelVacationNoticeTitle(1)).toBe(
      "1 dostawca na urlopie w kolejce"
    );
    expect(dailyPanelVacationNoticeTitle(2)).toBe(
      "2 dostawcy na urlopie w kolejce"
    );
    expect(dailyPanelVacationNoticeTitle(5)).toBe(
      "5 dostawców na urlopie w kolejce"
    );
    expect(dailyPanelVacationNoticeTitle(12)).toBe(
      "12 dostawców na urlopie w kolejce"
    );
    expect(dailyPanelVacationNoticeTitle(22)).toBe(
      "22 dostawcy na urlopie w kolejce"
    );
  });

  it("pusty przy 0", () => {
    expect(dailyPanelVacationNoticeTitle(0)).toBe("");
  });
});

describe("dailyPanelVacationNoticeHint / CTA", () => {
  it("ma czytelny hint i CTA", () => {
    expect(dailyPanelVacationNoticeHint().length).toBeGreaterThan(10);
    expect(dailyPanelVacationNoticeCtaLabel()).toBe("Urlopy");
  });
});
