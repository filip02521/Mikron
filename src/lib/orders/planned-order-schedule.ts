import { fetchSuppliersWithSchedules } from "@/lib/data/queries";
import {
  supplierIdsForPlannedOrderSchedule,
  type SupplierScheduleSnapshot,
} from "@/lib/orders/my-order-presenter";
import { buildWeekDayPlansFromSupplierSchedules } from "@/lib/orders/planned-order-date-label";
import type { WeekDayPlan } from "@/lib/orders/summary-workspace";
import type { IndividualOrder } from "@/types/database";

export type PlannedOrderScheduleContext = {
  supplierScheduleById: Record<string, SupplierScheduleSnapshot>;
  weekDays: WeekDayPlan[];
};

/** Harmonogramy tylko dla dostawców z otwartych pozycji „przed zamówieniem”. */
export async function loadPlannedOrderScheduleContext(
  orders: IndividualOrder[],
  todayDateKey: string
): Promise<PlannedOrderScheduleContext> {
  const plannedSupplierIds = supplierIdsForPlannedOrderSchedule(orders);
  const scheduleRows =
    plannedSupplierIds.length > 0
      ? await fetchSuppliersWithSchedules(undefined, {
          activeOnly: true,
          supplierIds: plannedSupplierIds,
        })
      : [];

  const supplierScheduleById = Object.fromEntries(
    scheduleRows.map((supplier) => [
      supplier.id,
      {
        computedNextDate: supplier.schedule?.computed_next_date ?? null,
        orderOnDemand: supplier.order_on_demand,
      },
    ])
  );

  const weekDays = buildWeekDayPlansFromSupplierSchedules(
    scheduleRows.map((supplier) => ({
      supplierId: supplier.id,
      computedNextDate: supplier.schedule?.computed_next_date ?? null,
    })),
    todayDateKey
  );

  return { supplierScheduleById, weekDays };
}
