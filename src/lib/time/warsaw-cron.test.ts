import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { morningRoutineAlreadyRanToday } from "./warsaw-cron";

vi.mock("@/lib/services/cron-run-log", () => ({
  readCronRun: vi.fn(),
  recordCronRun: vi.fn(),
}));

import { readCronRun } from "@/lib/services/cron-run-log";

/** Środa 18.06.2026, 06:00 Warszawa (CEST). */
const WARSAW_MORNING = new Date("2026-06-18T04:00:00.000Z");

describe("morningRoutineAlreadyRanToday", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(WARSAW_MORNING);
    vi.mocked(readCronRun).mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("blokuje ponowne uruchomienie tego samego dnia nawet po częściowych błędach e-mail", async () => {
    vi.mocked(readCronRun).mockResolvedValue({
      ok: false,
      at: "2026-06-18T04:05:00.000Z",
      detail: { warsawDateKey: "2026-06-18" },
      error: "email failed",
    });

    expect(await morningRoutineAlreadyRanToday()).toBe(true);
  });

  it("pozwala uruchomić gdy ostatni wpis to skip poza oknem", async () => {
    vi.mocked(readCronRun).mockResolvedValue({
      ok: true,
      at: "2026-06-18T03:00:00.000Z",
      detail: { skipped: true, reason: "outside_warsaw_6am_window", warsawDateKey: "2026-06-18" },
    });

    expect(await morningRoutineAlreadyRanToday()).toBe(false);
  });

  it("pozwala uruchomić gdy brak wpisu na dziś", async () => {
    vi.mocked(readCronRun).mockResolvedValue({
      ok: true,
      at: "2026-06-17T04:00:00.000Z",
      detail: { warsawDateKey: "2026-06-17" },
    });

    expect(await morningRoutineAlreadyRanToday()).toBe(false);
  });
});
