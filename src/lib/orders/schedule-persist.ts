import type { ScheduleRowOutput } from "@/lib/orders/recalc";
import { dateToIso, parseDateOnly } from "@/lib/orders/dates";
import { effectiveShiftDate } from "@/lib/orders/vacations";
import { todayInWarsaw } from "@/lib/time/warsaw";

/** Zapis shift_date — wygasłe ręczne przesunięcia nie zostają w bazie. */
export function resolvePersistedShiftDate(
  shiftDateRaw: string | null | undefined,
  today = todayInWarsaw()
): string | null {
  const parsed = parseDateOnly(shiftDateRaw ?? null);
  if (!parsed) return null;
  const effective = effectiveShiftDate(parsed, today);
  return effective ? dateToIso(effective) : null;
}

export function buildScheduleUpsertFromRecalc(input: {
  supplierId: string;
  orderDate: string | null;
  shiftDate: string | null;
  recalc: ScheduleRowOutput;
  today?: Date;
}) {
  return {
    supplier_id: input.supplierId,
    order_date: input.orderDate,
    shift_date: resolvePersistedShiftDate(input.shiftDate, input.today),
    computed_next_date: dateToIso(input.recalc.computedNextDate),
    vacation_note: input.recalc.vacationNote,
    updated_at: new Date().toISOString(),
  };
}
