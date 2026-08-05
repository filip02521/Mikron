import { describe, expect, it } from "vitest";
import {
  DAILY_PANEL_UNDO_MS,
  UNDO_WINDOW_MS,
  buildDailyPanelUndoPayload,
  isUndoPayloadExpired,
  undoExpiredServerMessage,
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
    expect(undoExpiredServerMessage()).toContain("10 s");
    expect(undoExpiredServerMessage("przy cofaniu odbioru")).toContain(
      "przy cofaniu odbioru"
    );
  });

  it("buildDailyPanelUndoPayload dla flag zakupów ma expiresAt", () => {
    const payload = buildDailyPanelUndoPayload({
      kind: "procurement_flags",
      snapshots: [
        {
          orderId: "o1",
          procurementFlag: null,
          procurementFlagNote: null,
          procurementFlagUpdatedAt: null,
          procurementFlagUpdatedBy: null,
        },
      ],
    });
    expect(payload.token.kind).toBe("procurement_flags");
    expect(payload.expiresAt).toBe(payload.performedAt + UNDO_WINDOW_MS);
    expect(isUndoPayloadExpired(payload, payload.performedAt)).toBe(false);
    expect(isUndoPayloadExpired(payload, payload.expiresAt! + 1)).toBe(true);
  });
});
