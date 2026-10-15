import type { SupplierScheduleSnapshot } from "@/lib/orders/my-order-presenter";
import {
  buildPlannedOrderDateDisplay,
  buildWeekDayPlansFromSupplierSchedules,
  type PlannedOrderDateDisplay,
} from "@/lib/orders/planned-order-date-label";
import type { WeekDayPlan } from "@/lib/orders/summary-workspace";
import { formatDateString } from "@/lib/orders/dates";
import { todayInWarsaw } from "@/lib/time/warsaw";

export type ProsbaSupplierScheduleRow = {
  id: string;
  order_on_demand: boolean;
  schedule?: { computed_next_date: string | null } | null;
};

/** Mapa harmonogramów do kontekstu formularza `/prosba`. */
export function buildProsbaSupplierScheduleById(
  rows: ProsbaSupplierScheduleRow[]
): Record<string, SupplierScheduleSnapshot> {
  return Object.fromEntries(
    rows.map((supplier) => [
      supplier.id,
      {
        computedNextDate: supplier.schedule?.computed_next_date ?? null,
        orderOnDemand: Boolean(supplier.order_on_demand),
      } satisfies SupplierScheduleSnapshot,
    ])
  );
}

export function buildProsbaPlannedOrderWeekDays(
  scheduleById: Record<string, SupplierScheduleSnapshot>,
  todayDateKey?: string
): WeekDayPlan[] {
  const today = todayDateKey ?? formatDateString(todayInWarsaw());
  return buildWeekDayPlansFromSupplierSchedules(
    Object.entries(scheduleById).map(([supplierId, snap]) => ({
      supplierId,
      computedNextDate: snap.computedNextDate,
    })),
    today
  );
}

/** Planowe zamówienie dla znanego dostawcy na formularzu prośby. */
export function prosbaPlannedOrderDisplay(input: {
  supplierId: string | null | undefined;
  scheduleById: Record<string, SupplierScheduleSnapshot>;
  todayDateKey?: string;
  weekDays?: WeekDayPlan[];
}): PlannedOrderDateDisplay | null {
  const supplierId = input.supplierId?.trim();
  if (!supplierId) return null;
  const snap = input.scheduleById[supplierId];
  if (!snap) return null;
  return buildPlannedOrderDateDisplay({
    computedNextDate: snap.computedNextDate,
    orderOnDemand: snap.orderOnDemand,
    todayDateKey: input.todayDateKey,
    weekDays: input.weekDays,
    supplierId,
  });
}
