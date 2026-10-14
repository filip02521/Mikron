import { describe, expect, it } from "vitest";
import {
  buildProsbaPlannedOrderWeekDays,
  buildProsbaSupplierScheduleById,
  prosbaPlannedOrderDisplay,
} from "@/lib/orders/prosba-planned-order-display";

describe("buildProsbaSupplierScheduleById", () => {
  it("mapuje computed_next_date i order_on_demand", () => {
    const map = buildProsbaSupplierScheduleById([
      {
        id: "s1",
        order_on_demand: false,
        schedule: { computed_next_date: "2026-10-15" },
      },
      {
        id: "s2",
        order_on_demand: true,
        schedule: null,
      },
    ]);
    expect(map.s1).toEqual({
      computedNextDate: "2026-10-15",
      orderOnDemand: false,
    });
    expect(map.s2).toEqual({
      computedNextDate: null,
      orderOnDemand: true,
    });
  });
});

describe("prosbaPlannedOrderDisplay", () => {
  const scheduleById = buildProsbaSupplierScheduleById([
    {
      id: "ondemand",
      order_on_demand: true,
      schedule: null,
    },
    {
      id: "dated",
      order_on_demand: false,
      schedule: { computed_next_date: "2026-10-15" },
    },
    {
      id: "overdue",
      order_on_demand: false,
      schedule: { computed_next_date: "2026-10-01" },
    },
    {
      id: "empty",
      order_on_demand: false,
      schedule: { computed_next_date: null },
    },
  ]);

  it("zwraca null bez supplierId", () => {
    expect(
      prosbaPlannedOrderDisplay({
        supplierId: "",
        scheduleById,
        todayDateKey: "2026-10-13",
      })
    ).toBeNull();
  });

  it("zwraca null gdy brak wpisu w mapie", () => {
    expect(
      prosbaPlannedOrderDisplay({
        supplierId: "missing",
        scheduleById,
        todayDateKey: "2026-10-13",
      })
    ).toBeNull();
  });

  it("pokazuje Na żądanie", () => {
    const display = prosbaPlannedOrderDisplay({
      supplierId: "ondemand",
      scheduleById,
      todayDateKey: "2026-10-13",
    });
    expect(display?.caption).toBe("Planowe zamówienie");
    expect(display?.label).toBe("Na żądanie");
  });

  it("pokazuje datę planową", () => {
    const weekDays = buildProsbaPlannedOrderWeekDays(scheduleById, "2026-10-13");
    const display = prosbaPlannedOrderDisplay({
      supplierId: "dated",
      scheduleById,
      todayDateKey: "2026-10-13",
      weekDays,
    });
    expect(display?.caption).toBe("Planowe zamówienie");
    expect(display?.label).toMatch(/15\.10|Czw|Śr|Wt|Pon|Pt/);
  });

  it("oznacza minięty termin", () => {
    const display = prosbaPlannedOrderDisplay({
      supplierId: "overdue",
      scheduleById,
      todayDateKey: "2026-10-13",
    });
    expect(display?.badgeVariant).toBe("warning");
    expect(display?.label).toMatch(/Minął termin/);
  });

  it("zwraca null gdy brak daty i nie on-demand", () => {
    expect(
      prosbaPlannedOrderDisplay({
        supplierId: "empty",
        scheduleById,
        todayDateKey: "2026-10-13",
      })
    ).toBeNull();
  });

  it("pokazuje Dziś gdy data = today", () => {
    const map = buildProsbaSupplierScheduleById([
      {
        id: "today",
        order_on_demand: false,
        schedule: { computed_next_date: "2026-10-13" },
      },
    ]);
    const display = prosbaPlannedOrderDisplay({
      supplierId: "today",
      scheduleById: map,
      todayDateKey: "2026-10-13",
    });
    expect(display?.label).toMatch(/^Dziś/);
    expect(display?.badgeVariant).toBe("info");
  });
});
