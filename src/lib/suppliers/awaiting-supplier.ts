/**
 * „Czeka na dostawcę” — termin odpowiedzi na wysłane ZD i zapytania (czyste funkcje, bez bazy).
 * Polska: odpowiedź do 1 dnia roboczego po wysyłce; zagranica i import: do 2 dni roboczych.
 */

import { isBusinessDay } from "@/lib/orders/business-calendar";
import { isZdSupplierAbroad } from "@/lib/orders/zd-estimate-post-create";
import { todayDateKeyInWarsaw } from "@/lib/time/warsaw";
import type { SupplierLocation } from "@/types/database";

export function awaitingReplyDueDays(location: SupplierLocation | null | undefined): number {
  return isZdSupplierAbroad(location) ? 2 : 1;
}

/** Dni robocze (pon.–pt., bez polskich świąt) po dniu wysyłki aż do dziś włącznie — daty warszawskie. */
export function businessDaysSince(sentAt: Date, now: Date = new Date()): number {
  const [sy, sm, sd] = todayDateKeyInWarsaw(sentAt).split("-").map(Number);
  const today = todayDateKeyInWarsaw(now);
  const day = new Date(sy, sm - 1, sd);
  let count = 0;
  // ponytail: pętla po dniach — lista obejmuje najwyżej 30 dni wstecz.
  for (let guard = 0; guard < 400; guard++) {
    day.setDate(day.getDate() + 1);
    const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
    if (key > today) break;
    if (isBusinessDay(day)) count++;
  }
  return count;
}

export type AwaitingReplyTiming = {
  dueDays: number;
  businessDays: number;
  /** Termin minął: więcej dni roboczych niż przewidziany czas odpowiedzi. */
  overdue: boolean;
};

export function awaitingReplyTiming(
  sentAt: Date,
  location: SupplierLocation | null | undefined,
  now: Date = new Date()
): AwaitingReplyTiming {
  const dueDays = awaitingReplyDueDays(location);
  const businessDays = businessDaysSince(sentAt, now);
  return { dueDays, businessDays, overdue: businessDays > dueDays };
}

/** „dziś”, „1 dzień rob.”, „3 dni rob.”. */
export function businessDaysLabel(days: number): string {
  if (days <= 0) return "dziś";
  return days === 1 ? "1 dzień rob." : `${days} dni rob.`;
}

/**
 * Stan po wysyłce na podstawie wiadomości w wątku: dostawca odpisał / mail wrócił (zwrot) / czeka.
 * Autoodpowiedzi i odpowiedzi kogoś z Mikranu nie zamykają czekania.
 */
export type AwaitingReplyStatus = "replied" | "bounced" | "waiting";

export function awaitingReplyStatus(replies: readonly { kind: string }[]): AwaitingReplyStatus {
  if (replies.some((r) => r.kind === "supplier")) return "replied";
  if (replies.some((r) => r.kind === "bounce")) return "bounced";
  return "waiting";
}
