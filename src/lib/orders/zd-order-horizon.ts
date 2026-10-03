/**
 * Horyzont zamówienia z czasem dostawy i harmonogramem — czysta logika.
 *
 * Opcja w Kreatorze ZD (domyślnie wyłączona): zamówienie ma wystarczyć
 * co najmniej do przyjazdu NASTĘPNEJ dostawy, nie tylko na „dni zapasu”.
 *
 *   L = czas dostawy (dni kalendarzowe) — p90 z dostaw „Główne” (≥5 próbek),
 *       inaczej p50, bez próbek 7 dni,
 *   N = dni do kolejnego planowego zamówienia po dzisiejszym (harmonogram),
 *       dostawca „na żądanie” / bez harmonogramu → 0,
 *   H = max(Z, N + L), gdzie Z = dni zapasu z karty dostawcy (minimum).
 *
 * Te same L i N zasilają sygnały panelu („skończy się przed dostawą”) — te
 * nie zmieniają ilości, tylko ostrzegają.
 */

import { differenceInCalendarDays } from "date-fns";
import {
  calculateBusinessDate,
  calculateNextOrderDate,
  formatDateString,
  parseDateOnly,
  type OrderInterval,
} from "@/lib/orders/dates";

/** Bez próbek dostaw — ostrożne założenie (dni kalendarzowe). */
export const ZD_HORIZON_DEFAULT_LEAD_DAYS = 7;
/** p90 jest wiarygodne od tylu dostaw (jak w statystykach dostaw). */
export const ZD_HORIZON_MIN_SAMPLES_P90 = 5;

export type ZdLeadTimeSource = "p90" | "p50" | "default";
export type ZdNextOrderSource = "schedule" | "interval" | "on_demand" | "none";

export type ZdOrderHorizon = {
  stockDays: number;
  leadBusinessDays: number | null;
  leadDays: number;
  leadSource: ZdLeadTimeSource;
  leadSampleCount: number;
  nextOrderDate: string | null;
  nextOrderDays: number;
  nextOrderSource: ZdNextOrderSource;
  /** H = max(Z, N + L). */
  horizonDays: number;
  /** O ile dni horyzont jest dłuższy niż zapas z karty (0 = bez zmiany ilości). */
  extendedByDays: number;
};

/** Dni robocze od dziś → dni kalendarzowe (weekendy i polskie święta). */
export function businessToCalendarDays(todayKey: string, businessDays: number): number {
  const today = parseDateOnly(todayKey);
  if (!today || !(businessDays > 0)) return 0;
  return Math.max(0, differenceInCalendarDays(calculateBusinessDate(today, businessDays), today));
}

export function resolveZdOrderHorizon(input: {
  todayKey: string;
  stockDays: number;
  onDemand: boolean;
  /** schedule.computed_next_date — najbliższe planowe zamówienie. */
  nextOrderDate: string | null;
  interval: OrderInterval | null;
  /** Kwantyle czasu dostawy (dni robocze) dla zamówień „Główne”. */
  lead: { p50: number | null; p90: number | null; nOrders: number } | null;
}): ZdOrderHorizon {
  const stockDays = Math.max(1, Math.round(input.stockDays));

  let leadBusinessDays: number | null = null;
  let leadSource: ZdLeadTimeSource = "default";
  if (input.lead?.p90 != null && input.lead.nOrders >= ZD_HORIZON_MIN_SAMPLES_P90) {
    leadBusinessDays = input.lead.p90;
    leadSource = "p90";
  } else if (input.lead?.p50 != null && input.lead.nOrders > 0) {
    leadBusinessDays = input.lead.p50;
    leadSource = "p50";
  }
  const leadDays =
    leadBusinessDays != null
      ? businessToCalendarDays(input.todayKey, leadBusinessDays)
      : ZD_HORIZON_DEFAULT_LEAD_DAYS;

  // Kolejne zamówienie PO dzisiejszym: gdy plan wypada dziś / jest zaległy,
  // to właśnie składamy to zamówienie — następne liczymy z interwału.
  const today = parseDateOnly(input.todayKey)!;
  let nextOrderDate: string | null = null;
  let nextOrderSource: ZdNextOrderSource = "none";
  if (input.onDemand) {
    nextOrderSource = "on_demand";
  } else {
    const planned = parseDateOnly(input.nextOrderDate);
    if (planned && differenceInCalendarDays(planned, today) > 0) {
      nextOrderDate = formatDateString(planned);
      nextOrderSource = "schedule";
    } else if (input.interval) {
      const next = calculateNextOrderDate(today, input.interval);
      if (next) {
        nextOrderDate = formatDateString(next);
        nextOrderSource = "interval";
      }
    }
  }
  const nextOrderDays = nextOrderDate
    ? Math.max(0, differenceInCalendarDays(parseDateOnly(nextOrderDate)!, today))
    : 0;

  const horizonDays = Math.max(stockDays, nextOrderDays + leadDays);
  return {
    stockDays,
    leadBusinessDays,
    leadDays,
    leadSource,
    leadSampleCount: input.lead?.nOrders ?? 0,
    nextOrderDate,
    nextOrderDays,
    nextOrderSource,
    horizonDays,
    extendedByDays: horizonDays - stockDays,
  };
}

export type ZdDeliveryRisk = "before_delivery" | "before_next_delivery";

/**
 * Sygnał z dni zapasu: towar skończy się, zanim przyjedzie zamówienie złożone
 * dziś (before_delivery) albo przed dostawą z kolejnego planowego zamówienia.
 * Uwzględnia towar już w drodze (otwarte ZD) — liczymy na stanie + w drodze.
 */
export function zdDeliveryRisk(input: {
  daysOfCoverWithIncoming: number | null;
  horizon: Pick<ZdOrderHorizon, "leadDays" | "nextOrderDays">;
}): ZdDeliveryRisk | null {
  const cover = input.daysOfCoverWithIncoming;
  if (cover == null) return null;
  if (cover < input.horizon.leadDays) return "before_delivery";
  if (cover < input.horizon.nextOrderDays + input.horizon.leadDays) return "before_next_delivery";
  return null;
}

function plDate(key: string): string {
  const [y, m, d] = key.split("-");
  return y && m && d ? `${d}.${m}` : key;
}

/** Opis horyzontu po polsku — Kreator (komunikat) i panel Braki. */
export function formatZdHorizonBreakdown(h: ZdOrderHorizon): string {
  const lead =
    h.leadSource === "default"
      ? `dostawa ~${h.leadDays} d (brak historii dostaw — założenie)`
      : `dostawa ~${h.leadDays} d (${h.leadSource === "p90" ? "9 na 10 dostaw" : "mediana"} z ${h.leadSampleCount} dostaw, ${h.leadBusinessDays} dni rob.)`;
  const next =
    h.nextOrderSource === "on_demand"
      ? "dostawca na żądanie — bez kolejnego zamówienia"
      : h.nextOrderDate
        ? `kolejne zamówienie ${plDate(h.nextOrderDate)} (za ${h.nextOrderDays} d)`
        : "brak terminu kolejnego zamówienia";
  const result =
    h.extendedByDays > 0
      ? `Cel liczony na ${h.horizonDays} dni (${h.nextOrderDays} + ${h.leadDays}) zamiast ${h.stockDays} — zamówienie wystarczy do kolejnej dostawy.`
      : `Zapas z karty (${h.stockDays} d) pokrywa czas do kolejnej dostawy — ilości bez zmian.`;
  return `${next}; ${lead}. ${result}`;
}
