import { formatDateString, toDateOnly } from "@/lib/orders/dates";

/** Niedziela = 0, sobota = 6 */
export function isWeekend(date: Date): boolean {
  const dow = toDateOnly(date).getDay();
  return dow === 0 || dow === 6;
}

/** Wielkanoc (niedziela) — algorytm gregoriański (Meeusa/Jonesa/Butchera). */
function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return toDateOnly(new Date(year, month - 1, day));
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return toDateOnly(d);
}

const holidayCache = new Map<number, Set<string>>();

/** Polskie dni ustawowo wolne od pracy (bez konfiguracji rocznej). */
export function polishPublicHolidayKeys(year: number): Set<string> {
  const cached = holidayCache.get(year);
  if (cached) return cached;

  const keys = new Set<string>();
  const fixed: Array<[number, number]> = [
    [1, 1],
    [1, 6],
    [5, 1],
    [5, 3],
    [8, 15],
    [11, 1],
    [11, 11],
    [12, 25],
    [12, 26],
  ];
  for (const [m, d] of fixed) {
    keys.add(formatDateString(new Date(year, m - 1, d)));
  }

  const easter = easterSunday(year);
  keys.add(formatDateString(easter));
  keys.add(formatDateString(addDays(easter, 1)));
  keys.add(formatDateString(addDays(easter, 49)));
  keys.add(formatDateString(addDays(easter, 60)));

  holidayCache.set(year, keys);
  return keys;
}

export function isPolishPublicHoliday(date: Date): boolean {
  const d = toDateOnly(date);
  return polishPublicHolidayKeys(d.getFullYear()).has(formatDateString(d));
}

export function isBusinessDay(date: Date): boolean {
  return !isWeekend(date) && !isPolishPublicHoliday(date);
}

/**
 * Przesuwa datę na najbliższy dzień roboczy (pon.–pt., bez polskich świąt).
 * Sobota/niedziela/święto → kolejny dzień roboczy.
 */
export function snapToBusinessDay(date: Date): Date {
  const result = toDateOnly(date);
  let guard = 0;
  while (!isBusinessDay(result) && guard < 30) {
    result.setDate(result.getDate() + 1);
    guard++;
  }
  return result;
}
