import type { SupplierLocation, VacationNote } from "@/types/database";
import { todayInWarsaw } from "@/lib/time/warsaw";
import { getRowColorForDate, modifyHexColor, type SummaryColorSet } from "./colors";
import { calculateNextOrderDate, toDateOnly, type OrderInterval } from "./dates";
import {
  applyVacationLogic,
  effectiveShiftDate,
  filterApplicableVacationPeriods,
  type VacationPeriod,
} from "./vacations";

function dayTs(d: Date): number {
  return toDateOnly(d).getTime();
}

export interface ScheduleRowInput {
  orderDate: Date | null;
  shiftDate: Date | null;
  interval: OrderInterval | null;
  location: SupplierLocation;
  vacations: VacationPeriod[];
}

export interface ScheduleRowOutput {
  computedNextDate: Date | null;
  vacationNote: VacationNote | null;
  rowColor: string | null;
  noteCellColor: string | null;
  nextDateCellColor: string | null;
}

export function recalcScheduleRow(
  input: ScheduleRowInput,
  colors?: SummaryColorSet,
  today = todayInWarsaw()
): ScheduleRowOutput {
  const shiftDate = effectiveShiftDate(input.shiftDate, today);
  const vacations = filterApplicableVacationPeriods(input.vacations, today);

  let { nextDate, vacationNote } = applyVacationLogic({
    orderDate: input.orderDate,
    shiftDate,
    interval: input.interval,
    location: input.location,
    vacations,
  });

  if (nextDate && dayTs(nextDate) < dayTs(today) && input.interval) {
    const shiftFromToday = calculateNextOrderDate(today, input.interval);
    if (shiftFromToday) {
      const bumped = applyVacationLogic({
        orderDate: input.orderDate,
        shiftDate: shiftFromToday,
        interval: input.interval,
        location: input.location,
        vacations,
      });
      nextDate = bumped.nextDate;
      vacationNote = bumped.vacationNote;
    }
  }

  const standardColor = getRowColorForDate(nextDate, colors, today);
  let nextDateCellColor = standardColor;
  let noteCellColor = standardColor;

  if (
    vacationNote === "PRZESUNIETE_PO" ||
    vacationNote === "PRZYSPIESZONE_PRZED"
  ) {
    nextDateCellColor = colors?.vacationWarning ?? "#fff3e0";
  }
  if (vacationNote && standardColor) {
    noteCellColor = modifyHexColor(standardColor, -10);
  }

  return {
    computedNextDate: nextDate,
    vacationNote,
    rowColor: standardColor,
    noteCellColor,
    nextDateCellColor,
  };
}
