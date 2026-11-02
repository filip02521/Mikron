import { describe, expect, it } from "vitest";
import { rolScanDue } from "./cron";

const p = (id: string, activeFrom = "2026-01-01", activeTo: string | null = null) => ({ id, activeFrom, activeTo });
const base = { period: "2026-10-01", todayKey: "2026-11-03" };

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

  it("jeden klient wysłany, drugi bez paczki — skan; klient nieaktywny w miesiącu pomijany", () => {
    const sent = { programId: "a", status: "wyslane" as const, scannedDateKey: "2026-11-01" };
    expect(rolScanDue({ ...base, programs: [p("a"), p("b")], batches: [sent] })).toBe(true);
    expect(rolScanDue({ ...base, programs: [p("a"), p("b", "2026-11-01")], batches: [sent] })).toBe(false);
  });
});
