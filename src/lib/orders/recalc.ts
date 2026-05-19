import type { SupplierLocation, VacationNote } from "@/types/database";
import { getRowColorForDate, modifyHexColor, type SummaryColorSet } from "./colors";
import type { OrderInterval } from "./dates";
import { applyVacationLogic, type VacationPeriod } from "./vacations";

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
  today = new Date()
): ScheduleRowOutput {
  const { nextDate, vacationNote } = applyVacationLogic({
    orderDate: input.orderDate,
    shiftDate: input.shiftDate,
    interval: input.interval,
    location: input.location,
    vacations: input.vacations,
  });

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
