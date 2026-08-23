import { describe, expect, it } from "vitest";
import {
  computeIvoclarWeeklyPeriod,
  IVOCLAR_WEEKLY_JOB_ID,
  previousCompleteIsoWeekRange,
} from "@/lib/services/mail/ivoclar-period";

describe("ivoclar-period", () => {
  it("exposes stable job id", () => {
    expect(IVOCLAR_WEEKLY_JOB_ID).toBe("ivoclar_weekly");
  });

  it("previousCompleteIsoWeekRange: wtorek → poprzedni pn–nd", () => {
    expect(previousCompleteIsoWeekRange("2026-08-18")).toEqual({
      dataOd: "2026-08-10",
      dataDo: "2026-08-16",
    });
  });

  it("previousCompleteIsoWeekRange: poniedziałek → tydzień sprzed tygodnia", () => {
    expect(previousCompleteIsoWeekRange("2026-08-17")).toEqual({
      dataOd: "2026-08-10",
      dataDo: "2026-08-16",
    });
  });

  it("computeIvoclarWeeklyPeriod builds ISO week key", () => {
    const period = computeIvoclarWeeklyPeriod("2026-08-18");
    expect(period).toEqual({
      periodKey: "2026-W33",
      periodLabel: "2026-08-10 – 2026-08-16 (2026-W33)",
      dataOd: "2026-08-10",
      dataDo: "2026-08-16",
    });
  });
});
