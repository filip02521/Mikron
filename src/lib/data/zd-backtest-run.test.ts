import { describe, expect, it } from "vitest";
import { zdBacktestRunStale } from "@/lib/data/zd-backtest-run";

describe("przerwany backtest", () => {
  const now = Date.parse("2026-10-24T12:00:00Z");
  it("w toku ponad 45 min = przerwany; świeży i zakończony — nie", () => {
    expect(zdBacktestRunStale("running", "2026-10-24T11:00:00Z", now)).toBe(true);
    expect(zdBacktestRunStale("queued", "2026-10-24T11:00:00Z", now)).toBe(true);
    expect(zdBacktestRunStale("running", "2026-10-24T11:30:00Z", now)).toBe(false);
    expect(zdBacktestRunStale("done", "2026-10-20T11:00:00Z", now)).toBe(false);
  });
});
