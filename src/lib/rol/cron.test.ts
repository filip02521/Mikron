import { describe, expect, it } from "vitest";
import type { RolFrequency } from "./constants";
import { rolCronRanges, rolScanDue } from "./cron";
import { rolMonthRange } from "./scan";

const p = (id: string, reportFrequency: RolFrequency = "month", active = true) => ({ id, active, reportFrequency });
const base = { range: rolMonthRange("2026-10-01"), todayKey: "2026-11-03" };

describe("rolScanDue", () => {
  it("bez klientów ROL nic do zrobienia", () => {
    expect(rolScanDue({ ...base, programs: [], batches: [] })).toBe(false);
  });

  it("pierwszy skan miesiąca: klient bez paczki — także po przerwie serwera", () => {
    expect(rolScanDue({ ...base, todayKey: "2026-11-01", programs: [p("a")], batches: [] })).toBe(true);
    expect(rolScanDue({ ...base, todayKey: "2026-11-06", programs: [p("a")], batches: [] })).toBe(true);
  });

  it("ponowny skan raz na dzień, dopóki paczka nie jest wysłana", () => {
    for (const status of ["wykryte", "przejrzane", "brak_zakupow"] as const) {
      expect(rolScanDue({ ...base, programs: [p("a")], batches: [{ programId: "a", status, scannedDateKey: "2026-11-02" }] })).toBe(true);
      expect(rolScanDue({ ...base, programs: [p("a")], batches: [{ programId: "a", status, scannedDateKey: "2026-11-03" }] })).toBe(false);
    }
  });

  it("po wysłaniu — bez skanu", () => {
    for (const status of ["wyslane", "potwierdzone", "do_korekty"] as const) {
      expect(rolScanDue({ ...base, programs: [p("a")], batches: [{ programId: "a", status, scannedDateKey: "2026-10-01" }] })).toBe(false);
    }
  });

  it("jeden klient wysłany, drugi bez paczki — skan; klient nieaktywny pomijany", () => {
    const sent = { programId: "a", status: "wyslane" as const, scannedDateKey: "2026-11-01" };
    expect(rolScanDue({ ...base, programs: [p("a"), p("b")], batches: [sent] })).toBe(true);
    expect(rolScanDue({ ...base, programs: [p("a"), p("b", "month", false)], batches: [sent] })).toBe(false);
  });

  it("tydzień: tylko klienci z raportem tygodniowym", () => {
    const week = { start: "2026-10-26", end: "2026-11-01" };
    expect(rolScanDue({ ...base, range: week, programs: [p("a")], batches: [] })).toBe(false);
    expect(rolScanDue({ ...base, range: week, programs: [p("a"), p("b", "week")], batches: [] })).toBe(true);
  });
});

describe("rolCronRanges", () => {
  it("sam miesiąc, gdy wszyscy mają raport miesięczny", () => {
    expect(rolCronRanges("2026-11-04", [p("a"), p("b", "week", false)])).toEqual([rolMonthRange("2026-10-01")]);
  });

  it("krótsze okresy przed miesiącem — FS trafia do najwcześniejszego raportu", () => {
    expect(rolCronRanges("2026-11-04", [p("a", "week"), p("b", "2weeks")])).toEqual([
      { start: "2026-10-26", end: "2026-11-01" },
      { start: "2026-10-12", end: "2026-10-25" },
      rolMonthRange("2026-10-01"),
    ]);
  });
});
