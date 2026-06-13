import { describe, expect, it } from "vitest";
import {
  presentMyOrders,
  supplierIdsForPlannedOrderSchedule,
} from "@/lib/orders/my-order-presenter";
import { buildWeekDayPlansFromSupplierSchedules } from "@/lib/orders/planned-order-date-label";
import type { IndividualOrder } from "@/types/database";

const baseOrder: IndividualOrder = {
  id: "1",
  supplier_id: "sup1",
  sales_person_id: "sp1",
  symbol: "ABC",
  products: "Wkręt",
  quantity: "3",
  delivered_quantity: "-",
  order_type: "Glowne",
  request_kind: "zamowienie",
  status: "Nowe",
  action_at: "2026-06-09",
  ordered_at: null,
  delivery_at: null,
  supplier: {
    id: "sup1",
    name: "Dostawca X",
    location: "POLSKA",
    pickup_mikran: false,
    pickup_pallet: false,
    notes: "",
    mails: "",
    extra_info: "",
    interval_raw: null,
    interval_weeks: null,
    stock_raw: null,
    stock: null,
    stats_mode: "LACZNIE",
    order_on_demand: false,
    is_active: true,
  },
};

describe("planned order date on /moje", () => {
  it("supplierIdsForPlannedOrderSchedule obejmuje informację via panel przed zamówieniem", () => {
    expect(
      supplierIdsForPlannedOrderSchedule([
        {
          ...baseOrder,
          id: "info-1",
          request_kind: "informacja",
          informacja_queue_via_daily_panel: true,
          ordered_at: null,
        },
      ])
    ).toEqual(["sup1"]);
  });

  it("supplierIdsForPlannedOrderSchedule zbiera tylko otwarte pozycje przed zamówieniem", () => {
    expect(
      supplierIdsForPlannedOrderSchedule([
        baseOrder,
        { ...baseOrder, id: "2", supplier_id: "sup2", status: "Zamowione" },
        {
          ...baseOrder,
          id: "3",
          supplier_id: null,
          status: "Nowe",
        },
      ])
    ).toEqual(["sup1"]);
  });

  it("presentMyOrders dołącza planową datę z etykietą tygodnia", () => {
    const weekDays = buildWeekDayPlansFromSupplierSchedules(
      [{ supplierId: "sup1", computedNextDate: "2026-06-11" }],
      "2026-06-09"
    );
    const row = presentMyOrders([baseOrder], [], {
      supplierScheduleById: {
        sup1: { computedNextDate: "2026-06-11", orderOnDemand: false },
      },
      todayDateKey: "2026-06-09",
      weekDays,
    }).zamowienia[0]!;

    expect(row.statusTitle).toBe("Przed zamówieniem");
    expect(row.plannedOrderDate?.label).toBe("Pojutrze · 11.06");
  });

  it("nie pokazuje planowej daty podczas weryfikacji", () => {
    const row = presentMyOrders(
      [{ ...baseOrder, status: "Weryfikacja" }],
      [],
      {
        supplierScheduleById: {
          sup1: { computedNextDate: "2026-06-11", orderOnDemand: false },
        },
        todayDateKey: "2026-06-09",
      }
    ).zamowienia[0]!;

    expect(row.statusTitle).toBe("W dziale dostaw");
    expect(row.plannedOrderDate).toBeUndefined();
  });
});
