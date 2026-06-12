import type { SupplierLocation, VacationNote } from "@/types/database";
import {
  calculateNextOrderDate,
  parseDateOnly,
  snapToBusinessDay,
  type OrderInterval,
  toDateOnly,
} from "./dates";

export interface VacationPeriod {
  start: Date;
  end: Date;
  lastOrder: Date;
}

export interface RecalcInput {
  orderDate: Date | null;
  shiftDate: Date | null;
  interval: OrderInterval | null;
  location: SupplierLocation;
  vacations: VacationPeriod[];
  currentVacationNote?: VacationNote | null;
}

export interface RecalcResult {
  nextDate: Date | null;
  vacationNote: VacationNote | null;
}

function dayTs(d: Date): number {
  return toDateOnly(d).getTime();
}

/** Czy data wpada w blok urlopu lub okno między ostatnim zamówieniem a startem urlopu. */
export function isDateInVacationWindow(date: Date, vac: VacationPeriod): boolean {
  const clean = dayTs(date);
  const vacStart = dayTs(vac.start);
  const vacEnd = dayTs(vac.end);
  const lastOrderTs = dayTs(vac.lastOrder);
  return (
    (clean >= vacStart && clean <= vacEnd) ||
    (clean > lastOrderTs && clean < vacStart)
  );
}

/** Nakładające się zakresy dat (włącznie z granicą). */
export function vacationRangesOverlap(
  a: { start: Date; end: Date },
  b: { start: Date; end: Date }
): boolean {
  return dayTs(a.start) <= dayTs(b.end) && dayTs(b.start) <= dayTs(a.end);
}

/** Urlop jeszcze wpływa na harmonogram (koniec >= dziś). */
export function isVacationStillApplicable(vac: VacationPeriod, today: Date): boolean {
  return dayTs(vac.end) >= dayTs(today);
}

/** Zaległe ręczne przesunięcie nie powinno blokować interwału. */
export function effectiveShiftDate(shiftDate: Date | null, today: Date): Date | null {
  if (!shiftDate) return null;
  if (dayTs(shiftDate) < dayTs(today)) return null;
  return shiftDate;
}

export function parseVacationPeriodRow(row: {
  start_date: string;
  end_date: string;
  last_order_date: string;
}): VacationPeriod | null {
  const start = parseDateOnly(row.start_date);
  const end = parseDateOnly(row.end_date);
  const lastOrder = parseDateOnly(row.last_order_date);
  if (!start || !end || !lastOrder) return null;
  return { start, end, lastOrder };
}

export function filterApplicableVacationPeriods(
  periods: VacationPeriod[],
  today: Date
): VacationPeriod[] {
  return periods.filter((p) => isVacationStillApplicable(p, today));
}

function resolveDateAfterVacation(vac: VacationPeriod): Date | null {
  return calculateNextOrderDate(vac.end, 1 / 7);
}

function applyVacationOverride(
  vac: VacationPeriod,
  location: SupplierLocation,
  orderDate: Date | null
): { finalDate: Date | null; vacationNote: VacationNote } {
  if (location === "ZAGRANICA") {
    const oneWeek = 7 * 24 * 60 * 60 * 1000;
    if (
      orderDate &&
      vac.lastOrder > orderDate &&
      vac.lastOrder.getTime() - orderDate.getTime() > oneWeek
    ) {
      return {
        finalDate: toDateOnly(vac.lastOrder),
        vacationNote: "PRZYSPIESZONE_PRZED",
      };
    }
  }
  return {
    finalDate: resolveDateAfterVacation(vac),
    vacationNote: "PRZESUNIETE_PO",
  };
}

export function applyVacationLogic(input: RecalcInput): RecalcResult {
  const { orderDate, shiftDate, interval, location } = input;
  const vacations = [...input.vacations].sort(
    (a, b) => dayTs(a.start) - dayTs(b.start)
  );

  const initialDate: Date | null =
    shiftDate ??
    (orderDate && interval ? calculateNextOrderDate(orderDate, interval) : null);

  if (!initialDate) {
    return { nextDate: null, vacationNote: null };
  }

  let finalDate: Date | null = null;
  let vacationNote: VacationNote | null = null;
  let vacationOverride = false;

  for (const vac of vacations) {
    if (!vac.start || !vac.end || !vac.lastOrder) continue;
    if (!isDateInVacationWindow(initialDate, vac)) continue;

    const resolved = applyVacationOverride(vac, location, orderDate);
    finalDate = resolved.finalDate;
    vacationNote = resolved.vacationNote;
    vacationOverride = true;
    break;
  }

  if (!vacationOverride) {
    finalDate = initialDate;
  }

  if (finalDate && interval && !vacationNote) {
    const lookAhead = calculateNextOrderDate(finalDate, interval);
    for (const vac of vacations) {
      if (
        vac.end &&
        finalDate < vac.end &&
        vac.lastOrder &&
        lookAhead &&
        lookAhead > vac.lastOrder
      ) {
        vacationNote = "OSTATNIE_ZAMOWIENIE";
        break;
      }
    }
  }

  return {
    nextDate: finalDate ? snapToBusinessDay(finalDate) : null,
    vacationNote,
  };
}

export function resolveVacationConflictOnShift(
  shiftDate: Date,
  location: SupplierLocation,
  vacations: VacationPeriod[],
  currentNote: VacationNote | null
): Date {
  for (const vac of vacations) {
    const clean = dayTs(shiftDate);
    if (clean < dayTs(vac.start) || clean > dayTs(vac.end)) continue;

    if (currentNote === "OSTATNIE_ZAMOWIENIE") {
      return snapToBusinessDay(calculateNextOrderDate(vac.end, 1 / 7) ?? shiftDate);
    }
    if (location === "ZAGRANICA") {
      return snapToBusinessDay(toDateOnly(vac.lastOrder));
    }
    return snapToBusinessDay(calculateNextOrderDate(vac.end, 1 / 7) ?? shiftDate);
  }
  return snapToBusinessDay(shiftDate);
}

export function resolveVacationConflictOnOrder(
  nextDate: Date,
  vacations: VacationPeriod[]
): Date {
  for (const vac of vacations) {
    if (isDateInVacationWindow(nextDate, vac)) {
      return snapToBusinessDay(resolveDateAfterVacation(vac) ?? nextDate);
    }
  }
  return snapToBusinessDay(nextDate);
}
