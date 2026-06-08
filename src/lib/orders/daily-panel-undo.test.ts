import { describe, expect, it } from "vitest";
import {
  DAILY_PANEL_UNDO_MS,
  UNDO_WINDOW_MS,
  undoWindowBannerDescription,
  undoWindowLongLabel,
  undoWindowShortLabel,
} from "@/lib/orders/daily-panel-undo";

describe("undo window", () => {
  it("uses 10 second window everywhere", () => {
    expect(UNDO_WINDOW_MS).toBe(10_000);
    expect(DAILY_PANEL_UNDO_MS).toBe(UNDO_WINDOW_MS);
    expect(undoWindowShortLabel()).toBe("10 s");
    expect(undoWindowLongLabel()).toBe("10 sekund");
    expect(undoWindowBannerDescription()).toBe("Masz 10 sekund na cofnięcie.");
    expect(undoWindowBannerDescription("Sprawdź terminy poniżej")).toBe(
      "Sprawdź terminy poniżej — masz 10 sekund na cofnięcie."
    );
  });
});
