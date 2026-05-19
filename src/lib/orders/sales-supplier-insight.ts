import {
  combinedAvgDays,
  mainAvgDays,
  sideAvgDays,
  totalSampleCount,
} from "@/lib/orders/delivery-stats-schema";
import { formatPlDate, formatSupplierIntervalForSales } from "@/lib/display-labels";
import { buildSupplierPlanInsight, type SupplierPlanInsight } from "@/lib/orders/plan-preview";
import type { WeekDayPlan } from "@/lib/orders/summary-workspace";
import type { DeliveryStats, StatsMode, SupplierWithSchedule } from "@/types/database";

export type SalesSupplierInsight = SupplierPlanInsight & {
  orderOnDemand: boolean;
  statsMode: StatsMode;
  orderIntervalLabel: string;
  leadTimeSummary: string | null;
  leadTimeDetail: string | null;
  leadTimeLowConfidence: boolean;
  sampleCount: number;
};

function daysLabel(n: number): string {
  if (n === 1) return "dzień roboczy";
  if (n >= 2 && n <= 4) return "dni robocze";
  return "dni roboczych";
}

function formatAvgDays(avg: number, count: number): string {
  return `~${avg} ${daysLabel(avg)} · ${count} ${count === 1 ? "dostawa" : count < 5 ? "dostawy" : "dostaw"} w historii`;
}

export function formatLeadTimeForSales(
  stats: DeliveryStats | undefined,
  statsMode: StatsMode
): Pick<SalesSupplierInsight, "leadTimeSummary" | "leadTimeDetail" | "leadTimeLowConfidence" | "sampleCount"> {
  const sampleCount = totalSampleCount(stats);
  const lowConfidence = sampleCount > 0 && sampleCount < 3;

  if (!stats || sampleCount === 0) {
    return {
      leadTimeSummary: null,
      leadTimeDetail: "Brak historii — po pierwszych dostawach pojawi się średni czas realizacji.",
      leadTimeLowConfidence: true,
      sampleCount: 0,
    };
  }

  if (statsMode === "LACZNIE") {
    const avg = combinedAvgDays(stats);
    if (avg != null && avg > 0) {
      return {
        leadTimeSummary: formatAvgDays(avg, sampleCount),
        leadTimeDetail: lowConfidence
          ? "Mało danych w historii — szacunek może się zmienić."
          : "Średni czas od złożenia zamówienia u dostawcy do dotarcia towaru na magazyn.",
        leadTimeLowConfidence: lowConfidence,
        sampleCount,
      };
    }
  } else {
    const main = mainAvgDays(stats);
    const side = sideAvgDays(stats);
    const parts: string[] = [];
    if (main != null && main > 0 && stats.main_count) {
      parts.push(`Planowe (główne): ${formatAvgDays(main, stats.main_count)}`);
    }
    if (side != null && side > 0 && stats.side_count) {
      parts.push(`Domówienie (poboczne): ${formatAvgDays(side, stats.side_count)}`);
    }
    if (parts.length) {
      return {
        leadTimeSummary: parts[0],
        leadTimeDetail: parts.length > 1 ? parts[1] : null,
        leadTimeLowConfidence: lowConfidence,
        sampleCount,
      };
    }
  }

  return {
    leadTimeSummary: null,
    leadTimeDetail: "Brak wiarygodnych średnich w statystykach.",
    leadTimeLowConfidence: true,
    sampleCount,
  };
}

export function buildSalesSupplierInsight(
  supplier: SupplierWithSchedule,
  weekDays: WeekDayPlan[],
  stats: DeliveryStats | undefined
): SalesSupplierInsight {
  const base = buildSupplierPlanInsight(supplier, weekDays);
  const lead = formatLeadTimeForSales(stats, supplier.stats_mode);

  return {
    ...base,
    orderOnDemand: supplier.order_on_demand,
    statsMode: supplier.stats_mode,
    orderIntervalLabel: formatSupplierIntervalForSales(
      supplier.interval_raw,
      supplier.interval_weeks
    ),
    ...lead,
  };
}

export type WeekOrderTimelineDay = {
  dateKey: string;
  weekdayLabel: string;
  dateLabel: string;
  isToday: boolean;
  suppliers: { id: string; name: string }[];
};

/** Kto jest w planie zakupów na dany dzień (ten tydzień). */
export function buildWeekOrderTimeline(days: WeekDayPlan[]): WeekOrderTimelineDay[] {
  return days
    .map((day) => ({
      dateKey: day.dateKey,
      weekdayLabel: day.weekdayLabel,
      dateLabel: day.dateLabel,
      isToday: day.isToday,
      suppliers: dedupeSuppliersById(
        day.items.map((i) => ({
          id: i.supplierId,
          name: i.flaggedName || i.supplierName,
        }))
      ),
    }))
    .filter((d) => d.suppliers.length > 0);
}

export function describeNextOrderForSales(insight: SalesSupplierInsight): {
  primary: string;
  secondary: string | null;
} {
  if (insight.orderOnDemand) {
    return {
      primary: "Na żądanie — bez stałego terminu w kalendarzu",
      secondary: "Zgłoś prośbę; dział dostaw zamówi, gdy będzie to możliwe.",
    };
  }

  if (!insight.nextDate) {
    return {
      primary: "Brak zaplanowanego terminu",
      secondary: "Skontaktuj się z działem dostaw lub zgłoś prośbę.",
    };
  }

  if (insight.isOverdue) {
    return {
      primary: `Termin minął (${formatPlDate(insight.nextDate) ?? insight.nextDate})`,
      secondary: "Zamówienie mogło już zostać złożone — sprawdź status prośby w Moje zamówienia.",
    };
  }

  if (insight.weekDayLabel && insight.weekDateLabel) {
    return {
      primary: `${insight.weekDayLabel} ${insight.weekDateLabel} — planowe zamówienie u dostawcy`,
      secondary: insight.vacationNote ? `Uwaga: ${insight.vacationNote}` : null,
    };
  }

  return {
    primary: `Planowane zamówienie: ${formatPlDate(insight.nextDate) ?? insight.nextDate}`,
    secondary: "Poza bieżącym tygodniem w kalendarzu zakupów.",
  };
}

function dedupeSuppliersById<T extends { id: string; name: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}
