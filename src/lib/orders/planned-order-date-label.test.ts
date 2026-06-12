import { describe, expect, it } from "vitest";
import {
  buildPlannedOrderDateDisplay,
  buildWeekDayPlansFromSupplierSchedules,
} from "@/lib/orders/planned-order-date-label";

describe("buildPlannedOrderDateDisplay", () => {
  it("zwraca Na żądanie dla dostawcy on-demand", () => {
    expect(
      buildPlannedOrderDateDisplay({
        computedNextDate: "2026-06-15",
        orderOnDemand: true,
        todayDateKey: "2026-06-09",
      })
    ).toMatchObject({
      label: "Na żądanie",
      badgeVariant: "default",
    });
  });

  it("zwraca null bez daty i bez on-demand", () => {
    expect(
      buildPlannedOrderDateDisplay({
        computedNextDate: null,
        orderOnDemand: false,
        todayDateKey: "2026-06-09",
      })
    ).toBeNull();
  });

  it("oznacza zaległy termin", () => {
    expect(
      buildPlannedOrderDateDisplay({
        computedNextDate: "2026-06-05",
        orderOnDemand: false,
        todayDateKey: "2026-06-09",
      })
    ).toMatchObject({
      label: "Minął termin · 05.06",
      badgeVariant: "warning",
    });
  });

  it("buildWeekDayPlansFromSupplierSchedules mapuje dostawcę na dzień tygodnia", () => {
    const weekDays = buildWeekDayPlansFromSupplierSchedules(
      [{ supplierId: "sup-1", computedNextDate: "2026-06-11" }],
      "2026-06-09"
    );
    const thursday = weekDays.find((day) => day.dateKey === "2026-06-11");
    expect(thursday?.weekdayLabel).toBe("Czw");
    expect(thursday?.items.some((item) => item.supplierId === "sup-1")).toBe(true);
  });

  it("pokazuje dziś z etykietą tygodnia gdy dostawca jest w planie", () => {
    expect(
      buildPlannedOrderDateDisplay({
        computedNextDate: "2026-06-09",
        orderOnDemand: false,
        todayDateKey: "2026-06-09",
        supplierId: "sup-1",
        weekDays: [
          {
            dateKey: "2026-06-09",
            weekdayLabel: "Pn",
            dateLabel: "09.06",
            isToday: true,
            isPast: false,
            items: [{ supplierId: "sup-1" } as never],
          },
        ],
      })
    ).toMatchObject({
      label: "Dziś · 09.06",
      badgeVariant: "info",
    });
  });
});
