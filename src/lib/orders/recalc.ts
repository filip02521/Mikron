import type { SupplierLocation, VacationNote } from "@/types/database";
import { todayInWarsaw } from "@/lib/time/warsaw";
import { getRowColorForDate, modifyHexColor, type SummaryColorSet } from "./colors";
import type { OrderInterval } from "./dates";
import {
  applyVacationLogic,
  effectiveShiftDate,
  filterApplicableVacationPeriods,
  type VacationPeriod,
} from "./vacations";

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

/**
 * Przelicza `computed_next_date` z order_date / shift_date + urlopy.
 *
 * Zaległe (`computed_next_date` < dziś) NIE są przewijane do przyszłości.
 * Zostają w panelu dziennym jako Zaległe, aż ktoś kliknie Zamówione lub Przesuń.
 * (Wcześniejszy auto-bump „dziś + interwał” kasował zaległości przy morning sync.)
 */
export function recalcScheduleRow(
  input: ScheduleRowInput,
  colors?: SummaryColorSet,
  today = todayInWarsaw()
): ScheduleRowOutput {
  const shiftDate = effectiveShiftDate(input.shiftDate, today);
  const vacations = filterApplicableVacationPeriods(input.vacations, today);

  const { nextDate, vacationNote } = applyVacationLogic({
    orderDate: input.orderDate,
    shiftDate,
    interval: input.interval,
    location: input.location,
    vacations,
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
