import { describe, expect, it } from "vitest";
import {
  buildScheduleUpsertFromRecalc,
  resolvePersistedShiftDate,
} from "./schedule-persist";

describe("schedule-persist", () => {
  const today = new Date("2025-09-01");

  it("clears stale shift_date on persist", () => {
    expect(resolvePersistedShiftDate("2025-08-01", today)).toBeNull();
  });

  it("keeps future shift_date on persist", () => {
    expect(resolvePersistedShiftDate("2025-10-01", today)).toBe("2025-10-01");
  });

  it("builds upsert payload from recalc output", () => {
    const payload = buildScheduleUpsertFromRecalc({
      supplierId: "s1",
      orderDate: "2025-08-01",
      shiftDate: "2025-08-10",
      recalc: {
        computedNextDate: new Date("2025-09-29"),
        vacationNote: null,
        rowColor: null,
        noteCellColor: null,
        nextDateCellColor: null,
      },
      today,
    });
    expect(payload.shift_date).toBeNull();
    expect(payload.computed_next_date).toBe("2025-09-29");
  });
});
