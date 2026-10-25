import { describe, expect, it } from "vitest";
import { zdKpiWeeklyDue, zdSkuClassDue } from "./zd-automat-catchup";

const run = (ok: boolean, detail: Record<string, unknown>) => ({ ok, at: "2026-10-01T05:00:00Z", detail });

describe("zdSkuClassDue", () => {
  it("bez wpisu, po błędzie albo pominięciu — do zrobienia", () => {
    expect(zdSkuClassDue(null, "2026-10-25")).toBe(true);
    expect(zdSkuClassDue(run(false, { asOf: "2026-10-01" }), "2026-10-25")).toBe(true);
    expect(zdSkuClassDue(run(true, { skipped: true, reason: "already_running", warsawDateKey: "2026-10-25" }), "2026-10-25")).toBe(true);
  });

  it("udany przebieg z tego miesiąca (także ręczny) — nie powtarza", () => {
    expect(zdSkuClassDue(run(true, { asOf: "2026-10-01" }), "2026-10-31")).toBe(false);
    expect(zdSkuClassDue(run(true, { asOf: "2026-10-24", manual: true }), "2026-10-25")).toBe(false);
  });

  it("częściowy błąd z zapisem zamyka miesiąc; błąd bez zapisu nie", () => {
    expect(zdSkuClassDue(run(false, { asOf: "2026-10-05", written: 5100, failed: 1 }), "2026-10-06")).toBe(false);
    expect(zdSkuClassDue(run(false, { asOf: "2026-10-05", written: 0 }), "2026-10-06")).toBe(true);
    expect(zdSkuClassDue(run(false, { subiektOffline: true }), "2026-10-06")).toBe(true);
  });

  it("nowy miesiąc — znowu do zrobienia", () => {
    expect(zdSkuClassDue(run(true, { asOf: "2026-10-31" }), "2026-11-01")).toBe(true);
  });
});

describe("zdKpiWeeklyDue", () => {
  // 2026-10-26 to poniedziałek: ostatni pełny tydzień zaczyna się 2026-10-19.
  it("po przebiegu za ostatni pełny tydzień — nie powtarza do końca tygodnia", () => {
    const last = run(true, { weekStart: "2026-10-19" });
    expect(zdKpiWeeklyDue(last, "2026-10-26")).toBe(false);
    expect(zdKpiWeeklyDue(last, "2026-11-01")).toBe(false);
    expect(zdKpiWeeklyDue(last, "2026-11-02")).toBe(true);
  });

  it("brak, błąd lub pominięcie — do zrobienia (także w środku tygodnia)", () => {
    expect(zdKpiWeeklyDue(null, "2026-10-28")).toBe(true);
    expect(zdKpiWeeklyDue(run(false, { weekStart: "2026-10-19", written: 0 }), "2026-10-28")).toBe(true);
    // jeden dostawca nie policzony, reszta zapisana — tydzień zamknięty, bez codziennych powtórek
    expect(zdKpiWeeklyDue(run(false, { weekStart: "2026-10-19", written: 9, failed: ["X"] }), "2026-10-28")).toBe(false);
    expect(zdKpiWeeklyDue(run(true, { skipped: true }), "2026-10-28")).toBe(true);
    expect(zdKpiWeeklyDue(run(true, { weekStart: "2026-10-12" }), "2026-10-28")).toBe(true);
  });
});
