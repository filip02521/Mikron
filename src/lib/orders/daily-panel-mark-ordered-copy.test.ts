import { describe, expect, it } from "vitest";
import {
  DAILY_PANEL_MARK_ORDERED_LABEL,
  DAILY_PANEL_MARK_ORDERED_PENDING,
  dailyPanelMarkOrderedConfirmLabel,
  dailyPanelMarkOrderedConfirmMessage,
  dailyPanelMarkOrderedConfirmTitle,
  dailyPanelMarkOrderedToastTitle,
} from "@/lib/orders/daily-panel-mark-ordered-copy";

describe("daily-panel-mark-ordered-copy", () => {
  it("exposes stable action labels", () => {
    expect(DAILY_PANEL_MARK_ORDERED_LABEL).toBe("Zamówione");
    expect(DAILY_PANEL_MARK_ORDERED_PENDING).toBe("Zapisywanie…");
    expect(dailyPanelMarkOrderedConfirmTitle()).toBe("Oznaczyć jako zamówione?");
    expect(dailyPanelMarkOrderedConfirmLabel()).toBe("Tak, zamówione");
  });

  it("builds confirm message with supplier name and undo window", () => {
    const msg = dailyPanelMarkOrderedConfirmMessage("Alpha Dental");
    expect(msg).toContain("„Alpha Dental”");
    expect(msg).toContain("zostało złożone u dostawcy");
    expect(msg).toContain("10 sekund");
    expect(msg).toContain("harmonogram");
  });

  it("falls back when supplier name is blank", () => {
    expect(dailyPanelMarkOrderedConfirmMessage("  ")).toContain("tego dostawcy");
  });

  it("builds toast title with and without supplier name", () => {
    expect(dailyPanelMarkOrderedToastTitle()).toBe("Oznaczono jako zamówione");
    expect(dailyPanelMarkOrderedToastTitle(null)).toBe("Oznaczono jako zamówione");
    expect(dailyPanelMarkOrderedToastTitle("  ")).toBe("Oznaczono jako zamówione");
    expect(dailyPanelMarkOrderedToastTitle("Beta")).toBe(
      "Zamówienie u „Beta” zapisane"
    );
  });
});
