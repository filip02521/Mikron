/** Czas warszawski (Europe/Warsaw) — Vercel Cron działa w UTC. */

import { subDays } from "date-fns";
import { formatDateString, parseDateOnly } from "@/lib/orders/dates";

const TZ = "Europe/Warsaw";

const weekdayFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ,
  weekday: "short",
});

const hourFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ,
  hour: "numeric",
  hour12: false,
});

export function warsawNowParts(date = new Date()): {
  hour: number;
  weekday: string;
  isWeekend: boolean;
  dateKey: string;
} {
  const weekday = weekdayFormatter.format(date);
  const hour = parseInt(hourFormatter.format(date), 10);
  const dateKey = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);

  const isWeekend = weekday === "Sat" || weekday === "Sun";

  return { hour, weekday, isWeekend, dateKey };
}

/** Czy to dzień roboczy w Warszawie (pn–pt). */
export function isWarsawBusinessDay(date = new Date()): boolean {
  return !warsawNowParts(date).isWeekend;
}

/** Okno porannej rutyny: 6:00–6:59 w Warszawie. */
export function isWarsawMorningRoutineHour(date = new Date()): boolean {
  const { hour, isWeekend } = warsawNowParts(date);
  return !isWeekend && hour === 6;
}

/** Godziny pracy magazynu/zakupów w Warszawie (8:00–18:59). */
export function isWarsawWorkHours(date = new Date()): boolean {
  const { hour, isWeekend } = warsawNowParts(date);
  return !isWeekend && hour >= 8 && hour <= 18;
}

/** Dziś (kalendarz) w strefie Europe/Warsaw — do zapisu order_date i list zaległych. */
export function todayInWarsaw(at: Date = new Date()): Date {
  return parseDateOnly(warsawNowParts(at).dateKey)!;
}

/** Klucz daty YYYY-MM-DD w Warszawie dla znacznika czasu ISO. */
export function warsawDateKeyFromIso(iso: string): string {
  return warsawNowParts(new Date(iso)).dateKey;
}

/** Klucz daty sprzed N dni kalendarzowych (Warszawa), względem dziś. */
export function warsawDateKeyDaysAgo(days: number, at: Date = new Date()): string {
  return formatDateString(subDays(todayInWarsaw(at), days));
}
