import { describe, it, expect } from "vitest";
import { computeVacationSchedulePreview } from "./vacation-preview";

describe("computeVacationSchedulePreview", () => {
  const today = new Date("2025-08-15");
  const baseSchedule = {
    orderDate: new Date("2025-08-01"),
    shiftDate: null as Date | null,
    interval: { unit: "weeks" as const, value: 4 },
    location: "POLSKA" as const,
    today,
  };

  it("shows shifted date after adding an active vacation", () => {
    const proposed = {
      supplier_id: "s1",
      start_date: "2025-08-25",
      end_date: "2025-09-05",
      last_order_date: "2025-08-20",
      active: true,
    };

    const preview = computeVacationSchedulePreview({
      ...baseSchedule,
      dbVacationRows: [],
      proposed,
    });

    expect(preview).not.toBeNull();
    expect(preview!.before.nextDate).toBe("2025-08-29");
    expect(preview!.after.nextDate).toBe("2025-09-08");
    expect(preview!.after.vacationNote).toBe("PRZESUNIETE_PO");
  });

  it("leaves schedule unchanged when vacation is inactive", () => {
    const proposed = {
      supplier_id: "s1",
      start_date: "2025-09-10",
      end_date: "2025-09-20",
      last_order_date: "2025-09-05",
      active: false,
    };

    const preview = computeVacationSchedulePreview({
      ...baseSchedule,
      dbVacationRows: [],
      proposed,
    });

    expect(preview!.before.nextDate).toBe(preview!.after.nextDate);
    expect(preview!.after.vacationNote).toBeNull();
  });
});
