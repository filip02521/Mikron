import type { SupplierLocation, VacationNote } from "@/types/database";
import { dateToIso, parseDateOnly, resolveSupplierInterval, type OrderInterval } from "./dates";
import { recalcScheduleRow } from "./recalc";
import { parseVacationPeriodRow, type VacationPeriod } from "./vacations";
import { todayInWarsaw } from "@/lib/time/warsaw";

export type VacationDbRow = {
  id: string;
  start_date: string;
  end_date: string;
  last_order_date: string;
  active: boolean;
};

export type VacationPreviewForm = {
  id?: string;
  supplier_id: string;
  start_date: string;
  end_date: string;
  last_order_date: string;
  active: boolean;
};

export type VacationPreviewSnapshot = {
  nextDate: string | null;
  vacationNote: VacationNote | null;
};

export type VacationSchedulePreview = {
  before: VacationPreviewSnapshot;
  after: VacationPreviewSnapshot;
};

function buildVacationPeriodsForRecalc(
  dbRows: VacationDbRow[],
  proposed: VacationPreviewForm,
  mode: "before" | "after"
): VacationPeriod[] {
  const activeRows = dbRows.filter((row) => row.active);

  if (mode === "before") {
    return activeRows
      .map((row) => parseVacationPeriodRow(row))
      .filter((period): period is VacationPeriod => period != null);
  }

  const periods = activeRows
    .filter((row) => !proposed.id || row.id !== proposed.id)
    .map((row) => parseVacationPeriodRow(row))
    .filter((period): period is VacationPeriod => period != null);

  if (proposed.active) {
    const period = parseVacationPeriodRow({
      start_date: proposed.start_date,
      end_date: proposed.end_date,
      last_order_date: proposed.last_order_date,
    });
    if (period) periods.push(period);
  }

  return periods.sort((a, b) => a.start.getTime() - b.start.getTime());
}

export function computeVacationSchedulePreview(input: {
  orderDate: Date | null;
  shiftDate: Date | null;
  interval: OrderInterval | null;
  location: SupplierLocation;
  dbVacationRows: VacationDbRow[];
  proposed: VacationPreviewForm;
  today?: Date;
}): VacationSchedulePreview | null {
  const { proposed } = input;
  if (
    !proposed.supplier_id ||
    !proposed.start_date ||
    !proposed.end_date ||
    !proposed.last_order_date
  ) {
    return null;
  }

  const today = input.today ?? todayInWarsaw();
  const scheduleInput = {
    orderDate: input.orderDate,
    shiftDate: input.shiftDate,
    interval: input.interval,
    location: input.location,
  };

  const before = recalcScheduleRow(
    {
      ...scheduleInput,
      vacations: buildVacationPeriodsForRecalc(input.dbVacationRows, proposed, "before"),
    },
    undefined,
    today
  );
  const after = recalcScheduleRow(
    {
      ...scheduleInput,
      vacations: buildVacationPeriodsForRecalc(input.dbVacationRows, proposed, "after"),
    },
    undefined,
    today
  );

  return {
    before: {
      nextDate: before.computedNextDate ? dateToIso(before.computedNextDate) : null,
      vacationNote: before.vacationNote,
    },
    after: {
      nextDate: after.computedNextDate ? dateToIso(after.computedNextDate) : null,
      vacationNote: after.vacationNote,
    },
  };
}

export function supplierScheduleForPreview(supplier: {
  location: string;
  interval_raw: string | null;
  interval_weeks: number | null;
  supplier_schedules:
    | {
        order_date: string | null;
        shift_date: string | null;
      }
    | Array<{
        order_date: string | null;
        shift_date: string | null;
      }>
    | null;
}) {
  const schedule = Array.isArray(supplier.supplier_schedules)
    ? supplier.supplier_schedules[0]
    : supplier.supplier_schedules;

  return {
    orderDate: parseDateOnly(schedule?.order_date ?? null),
    shiftDate: parseDateOnly(schedule?.shift_date ?? null),
    interval: resolveSupplierInterval(
      supplier.interval_raw,
      supplier.interval_weeks != null ? Number(supplier.interval_weeks) : null
    ),
    location: supplier.location as SupplierLocation,
  };
}
