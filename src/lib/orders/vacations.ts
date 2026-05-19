import type { SupplierLocation, VacationNote } from "@/types/database";
import { calculateNextOrderDate, snapToBusinessDay, type OrderInterval, toDateOnly } from "./dates";

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

export function applyVacationLogic(input: RecalcInput): RecalcResult {
  const { orderDate, shiftDate, interval, location } = input;
  const vacations = [...input.vacations].sort(
    (a, b) => dayTs(a.start) - dayTs(b.start)
  );

  let initialDate: Date | null =
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

    const cleanInitial = dayTs(initialDate);
    const vacStart = dayTs(vac.start);
    const vacEnd = dayTs(vac.end);
    const lastOrderTs = dayTs(vac.lastOrder);

    const inOrNearVacation =
      (cleanInitial >= vacStart && cleanInitial <= vacEnd) ||
      (cleanInitial > lastOrderTs && cleanInitial < vacStart);

    if (!inOrNearVacation) continue;

    if (location === "ZAGRANICA") {
      const oneWeek = 7 * 24 * 60 * 60 * 1000;
      if (
        orderDate &&
        vac.lastOrder > orderDate &&
        vac.lastOrder.getTime() - orderDate.getTime() > oneWeek
      ) {
        finalDate = toDateOnly(vac.lastOrder);
        vacationNote = "PRZYSPIESZONE_PRZED";
      } else {
        finalDate = calculateNextOrderDate(vac.end, 1 / 7);
        vacationNote = "PRZESUNIETE_PO";
      }
    } else {
      finalDate = calculateNextOrderDate(vac.end, 1 / 7);
      vacationNote = "PRZESUNIETE_PO";
    }
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
  const clean = dayTs(nextDate);
  for (const vac of vacations) {
    if (clean >= dayTs(vac.start) && clean <= dayTs(vac.end)) {
      return snapToBusinessDay(calculateNextOrderDate(vac.end, 1 / 7) ?? nextDate);
    }
  }
  return snapToBusinessDay(nextDate);
}
