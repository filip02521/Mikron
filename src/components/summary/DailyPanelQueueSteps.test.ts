import { describe, expect, it } from "vitest";
import { DAILY_PANEL_QUEUE_SECTION } from "@/lib/orders/daily-panel-section-anchors";

describe("DailyPanelQueueSteps anchors", () => {
  it("ma kotwice dla wszystkich kroków kolejki", () => {
    expect(DAILY_PANEL_QUEUE_SECTION.overdue).toBe("kolejka-zalegle");
    expect(DAILY_PANEL_QUEUE_SECTION.stockOut).toBe("kolejka-brak-na-stanie");
    expect(DAILY_PANEL_QUEUE_SECTION.prosby).toBe("kolejka-prosby");
    expect(DAILY_PANEL_QUEUE_SECTION.today).toBe("kolejka-harmonogram-dzis");
  });
});
