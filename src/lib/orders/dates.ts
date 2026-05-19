import { addMonths, addWeeks, format, startOfDay, parseISO } from "date-fns";
import { isBusinessDay, snapToBusinessDay } from "@/lib/orders/business-calendar";

export const TIMEZONE = "Europe/Warsaw";

export const MAX_INTERVAL_WEEKS = 104;

export type OrderInterval =
  | { unit: "weeks"; value: number }
  | { unit: "months"; value: number };

export function toDateOnly(d: Date): Date {
  return startOfDay(d);
}

export function formatDateString(d: Date, pattern = "yyyy-MM-dd"): string {
  return format(d, pattern);
}

export function parseDateOnly(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return null;
    return toDateOnly(value);
  }
  const parsed = parseISO(value.length === 10 ? `${value}T12:00:00` : value);
  if (isNaN(parsed.getTime())) return null;
  return toDateOnly(parsed);
}

function normalizeIntervalText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/**
 * Parsuje INTERWAL z arkusza:
 * - sama liczba → tygodnie (np. "3" = 3 tyg.)
 * - "3 miesiące" / "4 miesiace" → kalendarzowe miesiące
 */
export function parseInterval(value: unknown): OrderInterval | null {
  if (typeof value === "number" && value > 0) {
    const n = Math.round(value);
    if (n <= MAX_INTERVAL_WEEKS) return { unit: "weeks", value: n };
    return null;
  }
  if (typeof value !== "string" || !value.trim()) return null;

  const lower = normalizeIntervalText(value);

  if (lower.includes("kwartal")) return { unit: "months", value: 3 };
  if (lower.includes("pol roku") || lower.includes("pół roku")) return { unit: "months", value: 6 };
  if (/\brok\b/.test(lower) && !lower.includes("tyg")) return { unit: "months", value: 12 };

  const monthMatch = lower.match(/(\d+(?:[.,]\d+)?)\s*miesi/);
  if (monthMatch || lower.includes("miesiac")) {
    const num = monthMatch
      ? parseFloat(monthMatch[1].replace(",", "."))
      : parseFloat(lower);
    if (!isNaN(num) && num > 0 && num <= 24) {
      return { unit: "months", value: Math.round(num) };
    }
  }

  const num = parseFloat(lower.replace(",", "."));
  if (!isNaN(num) && num > 0 && num <= MAX_INTERVAL_WEEKS) {
    return { unit: "weeks", value: Math.round(num) };
  }
  return null;
}

export function resolveSupplierInterval(
  intervalRaw: string | null | undefined,
  intervalWeeks: number | null | undefined
): OrderInterval | null {
  if (intervalRaw?.trim()) {
    const parsed = parseInterval(intervalRaw);
    if (parsed) return parsed;
  }
  if (intervalWeeks != null) {
    const n = Number(intervalWeeks);
    if (!isNaN(n) && n > 0 && n <= MAX_INTERVAL_WEEKS) {
      return { unit: "weeks", value: Math.round(n) };
    }
  }
  return null;
}

export function formatIntervalLabel(interval: OrderInterval | null): string {
  if (!interval) return "—";
  if (interval.unit === "weeks") {
    return interval.value === 1 ? "1 tydzień" : `${interval.value} tyg.`;
  }
  if (interval.value === 1) return "1 miesiąc";
  return `${interval.value} mies.`;
}

/** Do kolumny interval_weeks — tylko gdy interwał jest w tygodniach */
export function intervalWeeksForStorage(
  intervalRaw: string,
  parsed: OrderInterval | null
): number | null {
  if (parsed?.unit === "weeks") return parsed.value;
  if (!intervalRaw.trim()) return null;
  return null;
}

/**
 * Następna data zamówienia: +N tygodni lub +N miesięcy, korekta weekendu.
 * Liczba ułamkowa (<1) = dni (np. 1/7 = +1 dzień po urlopie).
 */
export function calculateNextOrderDate(
  baseDate: Date,
  interval: number | OrderInterval
): Date | null {
  if (isNaN(baseDate.getTime())) return null;

  let next: Date;

  if (typeof interval === "number") {
    if (isNaN(interval) || interval < 0) return null;
    if (interval > 0 && interval < 1) {
      next = new Date(baseDate);
      next.setDate(next.getDate() + Math.max(1, Math.round(interval * 7)));
    } else if (interval > MAX_INTERVAL_WEEKS) {
      return null;
    } else {
      next = addWeeks(baseDate, interval);
    }
  } else if (interval.unit === "weeks") {
    if (interval.value > MAX_INTERVAL_WEEKS) return null;
    next = addWeeks(baseDate, interval.value);
  } else {
    if (interval.value < 1 || interval.value > 24) return null;
    next = addMonths(baseDate, interval.value);
  }

  return snapToBusinessDay(next);
}

export function calculateBusinessDays(startDate: Date, endDate: Date): number {
  const start = toDateOnly(startDate);
  const end = toDateOnly(endDate);
  if (start >= end) return 0;

  let businessDays = 0;
  let cursor = new Date(start);
  cursor.setDate(cursor.getDate() + 1);
  while (cursor <= end) {
    if (isBusinessDay(cursor)) businessDays++;
    cursor.setDate(cursor.getDate() + 1);
  }
  return businessDays;
}

export function calculateBusinessDate(startDate: Date, businessDays: number): Date {
  if (businessDays <= 0) return snapToBusinessDay(startDate);
  let result = toDateOnly(startDate);
  let added = 0;
  while (added < businessDays) {
    result.setDate(result.getDate() + 1);
    if (isBusinessDay(result)) added++;
  }
  return result;
}

export function getMondayOfWeek(d: Date): Date {
  const today = toDateOnly(d);
  const dayOfWeek = (today.getDay() + 6) % 7;
  const monday = new Date(today);
  monday.setDate(today.getDate() - dayOfWeek);
  return monday;
}

export function getFridayOfWeek(monday: Date): Date {
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  return friday;
}

/** @deprecated Użyj snapToBusinessDay — obejmuje też polskie święta. */
export function correctWeekendDate(date: Date): Date {
  return snapToBusinessDay(date);
}

export { isBusinessDay, snapToBusinessDay } from "@/lib/orders/business-calendar";

/** @deprecated Użyj parseInterval — zwraca tygodnie tylko dla liczb / tygodni (ZAPAS itp.) */
export function parseIntervalWeeks(value: unknown): number | null {
  const parsed = parseInterval(value);
  if (!parsed) return null;
  if (parsed.unit === "weeks") return parsed.value;
  return Math.round(parsed.value * 4.345);
}

export function dateToIso(d: Date | null | undefined): string | null {
  if (!d || isNaN(d.getTime())) return null;
  return formatDateString(d);
}
