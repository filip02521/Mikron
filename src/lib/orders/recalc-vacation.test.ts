import { describe, it, expect } from "vitest";
import { recalcScheduleRow } from "./recalc";
import { formatDateString } from "./dates";

describe("recalcScheduleRow vacation safeguards", () => {
  it("ignores past shift_date when recalculating schedule", () => {
    const today = new Date("2025-08-15");
    const result = recalcScheduleRow(
      {
        orderDate: new Date("2025-08-01"),
        shiftDate: new Date("2025-08-10"),
        interval: { unit: "weeks", value: 4 },
        location: "POLSKA",
        vacations: [
          {
            start: new Date("2025-08-01"),
            end: new Date("2025-08-15"),
            lastOrder: new Date("2025-07-25"),
          },
        ],
      },
      undefined,
      today
    );
    expect(formatDateString(result.computedNextDate!)).toBe("2025-08-29");
    expect(result.vacationNote).toBeNull();
  });

  it("bumps overdue computed date forward from today", () => {
    const today = new Date("2025-09-01");
    const result = recalcScheduleRow(
      {
        orderDate: new Date("2025-06-01"),
        shiftDate: null,
        interval: { unit: "weeks", value: 4 },
        location: "POLSKA",
        vacations: [],
      },
      undefined,
      today
    );
    expect(formatDateString(result.computedNextDate!)).toBe("2025-09-29");
    expect(result.vacationNote).toBeNull();
  });

  it("bumps overdue date and still applies active vacation", () => {
    const today = new Date("2025-09-01");
    const result = recalcScheduleRow(
      {
        orderDate: new Date("2025-06-01"),
        shiftDate: null,
        interval: { unit: "weeks", value: 4 },
        location: "POLSKA",
        vacations: [
          {
            start: new Date("2025-09-25"),
            end: new Date("2025-10-05"),
            lastOrder: new Date("2025-09-20"),
          },
        ],
      },
      undefined,
      today
    );
    expect(formatDateString(result.computedNextDate!)).toBe("2025-10-06");
    expect(result.vacationNote).toBe("PRZESUNIETE_PO");
  });
});
