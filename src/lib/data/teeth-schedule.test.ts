import { describe, expect, it } from "vitest";
import { computeTeethNextDate } from "@/lib/data/teeth-schedule";
import { parseDateOnly } from "@/lib/orders/dates";
import type { DayOfWeek } from "@/types/database";

function date(str: string): Date {
  return parseDateOnly(str)!;
}

// 2026-07-06 = poniedziałek
// 2026-07-07 = wtorek
// 2026-07-08 = środa
// 2026-07-09 = czwartek
// 2026-07-10 = piątek
// 2026-07-11 = sobota
// 2026-07-12 = niedziela

const MONDAY = date("2026-07-06");
const TUESDAY = date("2026-07-07");
const FRIDAY = date("2026-07-10");

describe("computeTeethNextDate", () => {
  it("bez last_order_date — najbliższy dzień tygodnia >= dziś", () => {
    const result = computeTeethNextDate(
      { order_day_of_week: 1 as DayOfWeek, interval_weeks: 1, last_order_date: null, shift_date: null },
      MONDAY
    );
    // Poniedziałek, base = dziś (poniedziałek) → ten sam poniedziałek
    expect(result).toEqual(MONDAY);
  });

  it("bez last_order_date — najbliższy wtorek gdy dziś to poniedziałek", () => {
    const result = computeTeethNextDate(
      { order_day_of_week: 2 as DayOfWeek, interval_weeks: 1, last_order_date: null, shift_date: null },
      MONDAY
    );
    expect(result).toEqual(TUESDAY);
  });

  it("z last_order_date — dodaj interwał i znajdź dzień tygodnia", () => {
    // last_order = poniedziałek 2026-06-29, interwał 1 tyg. → 2026-07-06 (poniedziałek)
    const result = computeTeethNextDate(
      { order_day_of_week: 1 as DayOfWeek, interval_weeks: 1, last_order_date: "2026-06-29", shift_date: null },
      MONDAY
    );
    expect(result).toEqual(date("2026-07-06"));
  });

  it("z last_order_date — interwał 2 tyg.", () => {
    // last_order = poniedziałek 2026-06-29, interwał 2 tyg. → 2026-07-13
    const result = computeTeethNextDate(
      { order_day_of_week: 1 as DayOfWeek, interval_weeks: 2, last_order_date: "2026-06-29", shift_date: null },
      MONDAY
    );
    expect(result).toEqual(date("2026-07-13"));
  });

  it("shift_date nadpisuje obliczenia", () => {
    const result = computeTeethNextDate(
      { order_day_of_week: 1 as DayOfWeek, interval_weeks: 1, last_order_date: "2026-06-29", shift_date: "2026-07-09" },
      MONDAY
    );
    // shift_date = czwartak 2026-07-09 (>= dziś) → snapToBusinessDay = czwartek
    expect(result).toEqual(date("2026-07-09"));
  });

  it("shift_date w przeszłości jest ignorowane", () => {
    const result = computeTeethNextDate(
      { order_day_of_week: 1 as DayOfWeek, interval_weeks: 1, last_order_date: "2026-06-29", shift_date: "2026-06-25" },
      MONDAY
    );
    // shift_date < dziś → ignorowane, oblicz normalnie → 2026-07-06
    expect(result).toEqual(date("2026-07-06"));
  });

  it("wynik w przeszłości — przewijanie o interwał", () => {
    // last_order = 2026-06-15, interwał 1 tyg., order_day = poniedziałek
    // base = 2026-06-22 (poniedziałek) → ale 2026-06-22 < dziś (2026-07-06)
    // przewiń: 2026-06-29 → 2026-07-06
    const result = computeTeethNextDate(
      { order_day_of_week: 1 as DayOfWeek, interval_weeks: 1, last_order_date: "2026-06-15", shift_date: null },
      MONDAY
    );
    expect(result).toEqual(date("2026-07-06"));
  });

  it("piątek — najbliższy piątek od poniedziałku", () => {
    const result = computeTeethNextDate(
      { order_day_of_week: 5 as DayOfWeek, interval_weeks: 1, last_order_date: null, shift_date: null },
      MONDAY
    );
    expect(result).toEqual(FRIDAY);
  });

  it("interwał 3 tyg. z last_order_date", () => {
    // last_order = poniedziałek 2026-06-15, interwał 3 tyg. → 2026-07-06
    const result = computeTeethNextDate(
      { order_day_of_week: 1 as DayOfWeek, interval_weeks: 3, last_order_date: "2026-06-15", shift_date: null },
      MONDAY
    );
    expect(result).toEqual(date("2026-07-06"));
  });
});
