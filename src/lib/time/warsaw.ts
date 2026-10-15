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

const dateTimeFormatter = new Intl.DateTimeFormat("pl-PL", {
  timeZone: TZ,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
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

/** Klucz daty YYYY-MM-DD dla dziś w Warszawie (zawsze string). */
export function todayDateKeyInWarsaw(at: Date = new Date()): string {
  return warsawNowParts(at).dateKey;
}

/** Klucz daty YYYY-MM-DD w Warszawie dla znacznika czasu ISO. */
export function warsawDateKeyFromIso(iso: string): string {
  return warsawNowParts(new Date(iso)).dateKey;
}

/** Klucz daty sprzed N dni kalendarzowych (Warszawa), względem dziś. */
export function warsawDateKeyDaysAgo(days: number, at: Date = new Date()): string {
  return formatDateString(subDays(todayInWarsaw(at), days));
}

/** Data i godzina w Europe/Warsaw — spójne SSR/klient. */
export function formatWarsawDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return dateTimeFormatter.format(d);
}

/** Północ dnia `YYYY-MM-DD` w Warszawie jako ISO z właściwym przesunięciem (+01:00 zimą, +02:00 latem). */
export function warsawMidnightIso(dateKey: string): string {
  // 00:00 UTC to jeszcze ten sam dzień w Warszawie i przed zmianą czasu (ta jest o 01:00 UTC).
  const probe = new Date(`${dateKey.slice(0, 10)}T00:00:00Z`);
  const tzName =
    new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Warsaw", timeZoneName: "shortOffset" })
      .formatToParts(probe)
      .find((p) => p.type === "timeZoneName")?.value ?? "GMT+1";
  const hours = Number(tzName.replace("GMT", "") || "0");
  const sign = hours < 0 ? "-" : "+";
  return `${dateKey.slice(0, 10)}T00:00:00${sign}${String(Math.abs(hours)).padStart(2, "0")}:00`;
}
