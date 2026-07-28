import { describe, it, expect } from "vitest";
import { recalcScheduleRow } from "./recalc";
import { formatDateString } from "./dates";
import { splitUrgentItems } from "./procurement-daily-ui";
import type { SummaryStandardItem } from "./summary";

function standardItem(nextDate: Date, supplierId = "s1"): SummaryStandardItem {
  return {
    kind: "standard",
    supplierId,
    supplierName: "Lab Test",
    flaggedName: "Lab Test",
    location: "POLSKA",
    nextDate,
    vacationNote: null,
    notes: "",
    shift: "",
    status: "",
    sourceSheet: "POLSKA",
    scheduleId: "sch1",
  };
}

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

  it("keeps overdue computed date instead of bumping from today", () => {
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
    // order_date 1.06 + 4 tyg. = 29.06 (niedziela) → snappowane do 30.06 — zostaje zaległe
    expect(formatDateString(result.computedNextDate!)).toBe("2025-06-30");
    expect(result.vacationNote).toBeNull();
  });

  it("does not slide overdue date forward on consecutive sync days", () => {
    const input = {
      orderDate: new Date("2025-06-01"),
      shiftDate: null,
      interval: { unit: "weeks" as const, value: 4 },
      location: "POLSKA" as const,
      vacations: [],
    };

    const monday = recalcScheduleRow(input, undefined, new Date("2025-09-01"));
    const tuesday = recalcScheduleRow(input, undefined, new Date("2025-09-02"));
    const nextWeek = recalcScheduleRow(input, undefined, new Date("2025-09-08"));

    expect(formatDateString(monday.computedNextDate!)).toBe("2025-06-30");
    expect(formatDateString(tuesday.computedNextDate!)).toBe("2025-06-30");
    expect(formatDateString(nextWeek.computedNextDate!)).toBe("2025-06-30");
  });

  it("keeps overdue even when a future vacation would only apply after a bump", () => {
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
    // Bez auto-bump urlop we wrześniu nie dotyczy zaległego czerwca.
    expect(formatDateString(result.computedNextDate!)).toBe("2025-06-30");
    expect(result.vacationNote).toBeNull();
  });

  it("after mark-ordered (order_date = today) advances to next cycle", () => {
    const today = new Date("2025-09-01");
    const result = recalcScheduleRow(
      {
        orderDate: today,
        shiftDate: null,
        interval: { unit: "weeks", value: 4 },
        location: "POLSKA",
        vacations: [],
      },
      undefined,
      today
    );
    expect(formatDateString(result.computedNextDate!)).toBe("2025-09-29");
  });

  it("respects future shift_date over overdue natural cycle", () => {
    const today = new Date("2025-09-01");
    const result = recalcScheduleRow(
      {
        orderDate: new Date("2025-06-01"),
        shiftDate: new Date("2025-09-10"),
        interval: { unit: "weeks", value: 4 },
        location: "POLSKA",
        vacations: [],
      },
      undefined,
      today
    );
    expect(formatDateString(result.computedNextDate!)).toBe("2025-09-10");
  });
});

describe("overdue daily panel survival after recalc", () => {
  it("recalc result still classifies as zaległe in panel split", () => {
    const today = new Date("2025-09-01");
    const recalc = recalcScheduleRow(
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

    const { overdue, todayList } = splitUrgentItems(
      [standardItem(recalc.computedNextDate!)],
      formatDateString(today)
    );

    expect(overdue).toHaveLength(1);
    expect(todayList).toHaveLength(0);
    expect(formatDateString(overdue[0]!.nextDate)).toBe("2025-06-30");
  });

  it("friday missed order still zaległe after monday-style recalc", () => {
    // order_date = 22.08 (piątek), interval 1 tydzień → next = 29.08
    // nie zamówiono w piątek 29.08; w poniedziałek 1.09 sync
    const monday = new Date("2025-09-01");
    const recalc = recalcScheduleRow(
      {
        orderDate: new Date("2025-08-22"),
        shiftDate: null,
        interval: { unit: "weeks", value: 1 },
        location: "POLSKA",
        vacations: [],
      },
      undefined,
      monday
    );

    expect(formatDateString(recalc.computedNextDate!)).toBe("2025-08-29");
    const { overdue, todayList } = splitUrgentItems(
      [standardItem(recalc.computedNextDate!)],
      formatDateString(monday)
    );
    expect(overdue).toHaveLength(1);
    expect(todayList).toHaveLength(0);
  });

  it("mark-ordered advances past urgent queue (next date after today)", () => {
    const today = new Date("2025-09-01");
    const todayKey = formatDateString(today);
    const recalc = recalcScheduleRow(
      {
        orderDate: today,
        shiftDate: null,
        interval: { unit: "weeks", value: 1 },
        location: "POLSKA",
        vacations: [],
      },
      undefined,
      today
    );
    const nextKey = formatDateString(recalc.computedNextDate!);
    expect(nextKey > todayKey).toBe(true);
    // Panel bierze tylko nextDate <= dziś — przyszła data wypada z kolejki Dziś.
    expect(nextKey <= todayKey).toBe(false);
  });
});
