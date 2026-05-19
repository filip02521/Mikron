import { describe, expect, it } from "vitest";
import { formatScheduleOutcomeLines } from "./daily-panel-action-feedback";

describe("formatScheduleOutcomeLines", () => {
  const base = {
    supplierName: "Dostawca X",
    nextOrderDate: "2026-06-15",
    intervalLabel: "4 tyg.",
    hasInterval: true,
    vacationNote: null,
  };

  it("Główne z przeliczeniem harmonogramu", () => {
    const lines = formatScheduleOutcomeLines(
      [{ ...base, scheduleAdjusted: true }],
      "GLOWNE"
    );
    expect(lines[0]).toContain("harmonogram przeliczony");
    expect(lines[0]).toContain("15.06.2026");
    expect(lines[0]).toContain("4 tyg.");
  });

  it("Uzupełniające bez zmiany harmonogramu", () => {
    const lines = formatScheduleOutcomeLines(
      [{ ...base, scheduleAdjusted: false }],
      "POBOCZNE"
    );
    expect(lines[0]).toContain("harmonogram bez zmian");
    expect(lines[0]).toContain("15.06.2026");
  });

  it("ostrzeżenie przy braku interwału", () => {
    const lines = formatScheduleOutcomeLines(
      [
        {
          ...base,
          hasInterval: false,
          intervalLabel: "—",
          nextOrderDate: null,
          scheduleAdjusted: false,
        },
      ],
      "POBOCZNE"
    );
    expect(lines[0]).toContain("brak interwału");
  });
});
