/**
 * ETA „na magazynie” dla Harmonogramu handlowców (/plan).
 * Osobno od ETA na /moje (tam start = ordered_at).
 */
import {
  estimateDeliveryEta,
  formatEtaLabel,
  type DeliveryEtaEstimate,
} from "@/lib/orders/delivery-eta";
import {
  calculateBusinessDate,
  formatDateString,
  parseDateOnly,
} from "@/lib/orders/dates";
import type { DeliveryStats, StatsMode, TeethSupplierSchedule } from "@/types/database";
import { todayDateKeyInWarsaw } from "@/lib/time/warsaw";

export type SalesPlanArrivalEta = {
  dateKey: string;
  shortLabel: string;
  fullLabel: string;
  avgBusinessDays: number;
  lowConfidence: boolean;
};

/** startAt dla forecastu: max(nextDate, today); null gdy na żądanie / brak terminu. */
export function salesPlanEtaStartAt(input: {
  nextDate: string | null;
  isOverdue: boolean;
  orderOnDemand: boolean;
  todayKey?: string;
}): string | null {
  if (input.orderOnDemand) return null;
  if (!input.nextDate) return null;
  const today = input.todayKey ?? todayDateKeyInWarsaw();
  if (input.isOverdue || input.nextDate < today) return today;
  return input.nextDate;
}

function shortOkLabel(dateKey: string): string {
  const d = parseDateOnly(dateKey);
  if (!d) return `ok. ${dateKey}`;
  return `ok. ${formatDateString(d, "dd.MM")}`;
}

/**
 * Jedna data ETA w wierszu.
 * LACZNIE → combined; OSOBNO → Glowne (planowe).
 */
export function buildSalesPlanArrivalEta(input: {
  startAt: string | null;
  stats: DeliveryStats | undefined;
  statsMode: StatsMode;
}): SalesPlanArrivalEta | null {
  if (!input.startAt) return null;
  const estimate = estimateDeliveryEta(
    input.startAt,
    input.stats,
    "Glowne",
    input.statsMode
  );
  if (!estimate) return null;
  return arrivalEtaFromEstimate(estimate);
}

export function arrivalEtaFromEstimate(
  estimate: DeliveryEtaEstimate
): SalesPlanArrivalEta {
  const dateKey = formatDateString(estimate.expectedDate, "yyyy-MM-dd");
  return {
    dateKey,
    shortLabel: shortOkLabel(dateKey),
    fullLabel: formatEtaLabel(estimate),
    avgBusinessDays: estimate.avgBusinessDays,
    lowConfidence: estimate.lowConfidence,
  };
}

export type SalesPlanTeethLine = {
  nextOrderLabel: string;
  etaLabel: string | null;
};

/** Linia toru zębów w expand — tylko gdy jest schedule + otwarta prośba zębowa. */
export function buildSalesPlanTeethLine(
  schedule: TeethSupplierSchedule | null | undefined,
  options?: {
    todayKey?: string;
    /** Precompute z historii (gdy brak stałego delivery_lead_business_days). */
    historyEtaLabel?: string | null;
  }
): SalesPlanTeethLine | null {
  if (!schedule?.computed_next_date) return null;
  const today = options?.todayKey ?? todayDateKeyInWarsaw();
  let startAt = schedule.computed_next_date;
  if (startAt < today) startAt = today;

  const nextOrderLabel =
    parseDateOnly(schedule.computed_next_date)
      ? formatDateString(parseDateOnly(schedule.computed_next_date)!, "dd.MM.yyyy")
      : schedule.computed_next_date;

  const lead = schedule.delivery_lead_business_days;
  if (lead != null && Number.isFinite(lead) && lead > 0) {
    const start = parseDateOnly(startAt);
    if (start) {
      const days = Math.trunc(lead);
      const expected = calculateBusinessDate(start, days);
      return {
        nextOrderLabel,
        etaLabel: formatEtaLabel({
          avgBusinessDays: days,
          expectedDate: expected,
          sampleCount: 0,
          lowConfidence: false,
        }),
      };
    }
  }

  const history = options?.historyEtaLabel?.trim();
  if (history) {
    return { nextOrderLabel, etaLabel: history };
  }

  return { nextOrderLabel, etaLabel: null };
}

export function isActiveShiftDate(
  shiftDate: string | null | undefined,
  todayKey?: string
): boolean {
  if (!shiftDate) return false;
  const today = todayKey ?? todayDateKeyInWarsaw();
  return shiftDate >= today;
}
