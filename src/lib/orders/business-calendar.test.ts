import { describe, expect, it } from "vitest";
import {
  countBusinessDaysInclusive,
  isBusinessDay,
  isPolishPublicHoliday,
  polishPublicHolidayKeys,
  snapToBusinessDay,
} from "./business-calendar";
import { formatDateString } from "./dates";

describe("business-calendar", () => {
  it("sobota przesuwa na poniedziałek", () => {
    const sat = new Date("2025-05-10");
    expect(snapToBusinessDay(sat).getDay()).toBe(1);
    expect(formatDateString(snapToBusinessDay(sat))).toBe("2025-05-12");
  });

  it("1 maja 2026 (piątek) przesuwa po weekendzie i 3 maja", () => {
    const mayDay = new Date("2026-05-01");
    expect(isPolishPublicHoliday(mayDay)).toBe(true);
    expect(snapToBusinessDay(mayDay).getDay()).toBe(1);
    expect(formatDateString(snapToBusinessDay(mayDay))).toBe("2026-05-04");
  });

  it("poniedziałek wielkanocny 2026 jest świętem", () => {
    const easterMonday = new Date("2026-04-06");
    expect(polishPublicHolidayKeys(2026).has("2026-04-06")).toBe(true);
    expect(isBusinessDay(easterMonday)).toBe(false);
  });

  it("zwykły wtorek roboczy", () => {
    const tue = new Date("2026-05-05T12:00:00");
    expect(isBusinessDay(tue)).toBe(true);
    expect(formatDateString(snapToBusinessDay(tue))).toBe("2026-05-05");
  });
});

describe("countBusinessDaysInclusive", () => {
  it("liczy oba końce, pomija weekendy i święta", () => {
    expect(countBusinessDaysInclusive("2026-10-05", "2026-10-16")).toBe(10);
    expect(countBusinessDaysInclusive("2026-11-09", "2026-11-13")).toBe(4); // 11.11
    expect(countBusinessDaysInclusive("2026-10-07", "2026-10-07")).toBe(1);
    expect(countBusinessDaysInclusive("2026-10-10", "2026-10-11")).toBe(0);
  });
});
