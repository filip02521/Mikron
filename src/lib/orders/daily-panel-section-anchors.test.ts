import { describe, expect, it } from "vitest";
import {
  DAILY_PANEL_QUEUE_SECTION,
  dailyPanelSectionHref,
  formatDailyPanelSyncLabel,
} from "./daily-panel-section-anchors";

describe("daily-panel-section-anchors", () => {
  it("generuje href kotwic", () => {
    expect(dailyPanelSectionHref("prosby")).toBe("#kolejka-prosby");
    expect(DAILY_PANEL_QUEUE_SECTION.stockOut).toBe("kolejka-brak-na-stanie");
  });

  it("formatuje etykietę synchronizacji", () => {
    const now = 1_000_000;
    expect(formatDailyPanelSyncLabel(null, null, now)).toBe("łączenie…");
    expect(formatDailyPanelSyncLabel(now - 5_000, null, now)).toBe(
      "sprawdzono przed chwilą"
    );
    expect(formatDailyPanelSyncLabel(now - 90_000, null, now)).toBe(
      "sprawdzono 1 min temu"
    );
    expect(formatDailyPanelSyncLabel(now - 360_000, now - 20_000, now)).toBe(
      "sprawdzono 20 s temu"
    );
  });
});

describe("kotwice grup listy dostawców", () => {
  it("grupa z kolejki ma tę samą kotwicę co krok kolejki; grupa spoza kolejki — wg wzoru", async () => {
    const { dailySupplierGroupAnchor } = await import("./daily-panel-section-anchors");
    for (const group of ["send", "order", "early", "shift", "manual"] as const) {
      expect(dailySupplierGroupAnchor(group)).toBe(DAILY_PANEL_QUEUE_SECTION[group]);
    }
    expect(dailySupplierGroupAnchor("done")).toBe("kolejka-dostawcy-done");
  });
});
