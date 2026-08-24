import {
  combinedAvgDays,
  mainAvgDays,
  sideAvgDays,
  totalSampleCount,
} from "@/lib/orders/delivery-stats-schema";
import { formatPlDate, formatSupplierIntervalForSales } from "@/lib/display-labels";
import { buildSupplierPlanInsight, type SupplierPlanInsight } from "@/lib/orders/plan-preview";
import { PROCUREMENT_TEAM_LABEL, PROCUREMENT_TEAM_LABEL_TITLE } from "@/lib/orders/procurement-copy";
import type { SupplierOnVacationWindow } from "@/lib/orders/procurement-supplier-vacation";
import {
  buildSalesPlanArrivalEta,
  buildSalesPlanTeethLine,
  isActiveShiftDate,
  salesPlanEtaStartAt,
  type SalesPlanArrivalEta,
  type SalesPlanTeethLine,
} from "@/lib/orders/sales-plan-eta";
import { buildSupplierContactUi } from "@/lib/orders/supplier-contact";
import type { WeekDayPlan } from "@/lib/orders/summary-workspace";
import { todayDateKeyInWarsaw } from "@/lib/time/warsaw";
import type {
  DeliveryStats,
  StatsMode,
  SupplierWithSchedule,
  TeethSupplierSchedule,
} from "@/types/database";

export type SalesSupplierInsight = SupplierPlanInsight & {
  orderOnDemand: boolean;
  statsMode: StatsMode;
  orderIntervalLabel: string;
  leadTimeSummary: string | null;
  leadTimeDetail: string | null;
  leadTimeLowConfidence: boolean;
  sampleCount: number;
  /** Szacunek daty na magazynie (null = na żądanie / brak terminu / brak historii). */
  arrivalEta: SalesPlanArrivalEta | null;
  onVacationNow: boolean;
  vacationWindow: SupplierOnVacationWindow | null;
  contactEmail: string | null;
  activeShift: boolean;
  lastOrderLabel: string | null;
  teethLine: SalesPlanTeethLine | null;
};

export type BuildSalesSupplierInsightOptions = {
  todayKey?: string;
  vacationWindow?: SupplierOnVacationWindow | null;
  teethSchedule?: TeethSupplierSchedule | null;
  /** Otwarta prośba zębowa dla tego dostawcy — bez tego teethLine = null. */
  hasOpenTeethRequest?: boolean;
  /** ETA z historii zębów (gdy brak stałego lead) — z loadera /plan. */
  teethHistoryEtaLabel?: string | null;
};

function daysLabel(n: number): string {
  const rounded = Math.round(n);
  if (rounded === 1) return "dzień roboczy";
  if (rounded >= 2 && rounded <= 4) return "dni robocze";
  return "dni roboczych";
}

function formatAvgDays(avg: number, count: number): string {
  const deliveries =
    count === 1 ? "dostawa" : count >= 2 && count <= 4 ? "dostawy" : "dostaw";
  return `~${avg} ${daysLabel(avg)} · ${count} ${deliveries} w historii`;
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
      leadTimeDetail:
        "Brak historii dostaw — średni czas realizacji pojawi się po pierwszych przyjęciach.",
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
          ? "Mało danych w historii — szacunek jest orientacyjny."
          : "Średni czas od złożenia zamówienia u dostawcy do przyjęcia towaru na magazyn.",
        leadTimeLowConfidence: lowConfidence,
        sampleCount,
      };
    }
  } else {
    const main = mainAvgDays(stats);
    const side = sideAvgDays(stats);
    const parts: string[] = [];
    if (main != null && main > 0 && stats.main_count) {
      parts.push(`Zamówienia planowe: ${formatAvgDays(main, stats.main_count)}`);
    }
    if (side != null && side > 0 && stats.side_count) {
      parts.push(
        `Zamówienia uzupełniające: ${formatAvgDays(side, stats.side_count)}`
      );
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
    leadTimeDetail: "Brak wystarczających danych do wyliczenia średniego czasu.",
    leadTimeLowConfidence: true,
    sampleCount,
  };
}

export function buildSalesSupplierInsight(
  supplier: SupplierWithSchedule,
  weekDays: WeekDayPlan[],
  stats: DeliveryStats | undefined,
  options?: BuildSalesSupplierInsightOptions
): SalesSupplierInsight {
  const todayKey = options?.todayKey ?? todayDateKeyInWarsaw();
  const base = buildSupplierPlanInsight(supplier, weekDays);
  // Spójne z ETA: overdue względem todayKey z loadera (nie osobnego zegara w plan-preview).
  const isOverdue = Boolean(base.nextDate && base.nextDate < todayKey);
  const lead = formatLeadTimeForSales(stats, supplier.stats_mode);
  const orderOnDemand = supplier.order_on_demand;
  const startAt = salesPlanEtaStartAt({
    nextDate: base.nextDate,
    isOverdue,
    orderOnDemand,
    todayKey,
  });
  const arrivalEta = buildSalesPlanArrivalEta({
    startAt,
    stats,
    statsMode: supplier.stats_mode,
  });
  const vacationWindow = options?.vacationWindow ?? null;
  const contact = buildSupplierContactUi(
    supplier.notes ?? "",
    supplier.mails ?? "",
    supplier.extra_info ?? ""
  );
  const shiftRaw = supplier.schedule?.shift_date ?? null;
  const teethLine =
    options?.hasOpenTeethRequest && options.teethSchedule
      ? buildSalesPlanTeethLine(options.teethSchedule, {
          todayKey,
          historyEtaLabel: options.teethHistoryEtaLabel ?? null,
        })
      : null;

  return {
    ...base,
    isOverdue,
    orderOnDemand,
    statsMode: supplier.stats_mode,
    orderIntervalLabel: formatSupplierIntervalForSales(
      supplier.interval_raw,
      supplier.interval_weeks
    ),
    ...lead,
    arrivalEta,
    onVacationNow: Boolean(vacationWindow),
    vacationWindow,
    contactEmail: contact.email,
    activeShift: isActiveShiftDate(shiftRaw, todayKey),
    lastOrderLabel: base.orderDate ? formatPlDate(base.orderDate) : null,
    teethLine,
  };
}

export function describeNextOrderForSales(
  insight: SalesSupplierInsight,
  options?: { readOnlyPreview?: boolean }
): {
  primary: string;
  secondary: string | null;
} {
  const readOnly = Boolean(options?.readOnlyPreview);

  if (insight.orderOnDemand) {
    return {
      primary: "Na żądanie — bez stałego dnia w kalendarzu zakupów",
      secondary: readOnly
        ? `${PROCUREMENT_TEAM_LABEL_TITLE} zamawia, gdy jest to możliwe.`
        : `Zgłoś prośbę — ${PROCUREMENT_TEAM_LABEL} zamówi, gdy będzie to możliwe.`,
    };
  }

  if (!insight.nextDate) {
    return {
      primary: "Brak zaplanowanego terminu zamówienia",
      secondary: readOnly
        ? "Skontaktuj się z działem zakupów."
        : "Skontaktuj się z działem zakupów albo zgłoś prośbę.",
    };
  }

  if (insight.isOverdue) {
    return {
      primary: `Planowany termin minął (${formatPlDate(insight.nextDate) ?? insight.nextDate})`,
      secondary:
        "Zamówienie mogło już zostać złożone — sprawdź status prośby w „Moje zamówienia”.",
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
    secondary: "Termin wypada poza bieżącym tygodniem w kalendarzu zakupów.",
  };
}
