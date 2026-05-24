import { describe, expect, it } from "vitest";
import {
  historyRetentionCutoffDateOnly,
  HISTORY_PREVIEW_COUNT,
  HISTORY_RETENTION_MONTHS,
  isHistoryTerminalStatus,
} from "./history-retention";

describe("history-retention", () => {
  it("obcina dane 6 miesięcy wstecz", () => {
    const cutoff = historyRetentionCutoffDateOnly(new Date("2026-05-15T12:00:00Z"));
    expect(cutoff).toBe("2025-11-15");
    expect(HISTORY_RETENTION_MONTHS).toBe(6);
    expect(HISTORY_PREVIEW_COUNT).toBe(6);
  });

  it("rozpoznaje statusy końcowe do czyszczenia", () => {
    expect(isHistoryTerminalStatus("Zrealizowane")).toBe(true);
    expect(isHistoryTerminalStatus("Nowe")).toBe(false);
  });
});
