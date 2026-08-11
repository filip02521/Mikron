import {
  calculateBusinessDate,
  calculateBusinessDays,
  formatDateString,
  parseDateOnly,
  toDateOnly,
} from "@/lib/orders/dates";
import {
  avgDaysForStatsMode,
  combinedAvgDays,
  mainAvgDays,
  sideAvgDays,
  totalSampleCount,
} from "@/lib/orders/delivery-stats-schema";
import type { DeliveryStats, OrderType, StatsMode } from "@/types/database";
import { MY_ORDER_HISTORY_ESTIMATE_LOW_CONFIDENCE_SUFFIX } from "@/lib/orders/my-order-history-estimate-copy";
import { todayInWarsaw } from "@/lib/time/warsaw";

export function avgDaysForOrderType(
  stats: DeliveryStats | null | undefined,
  orderType: OrderType,
  statsMode: StatsMode
): number | null {
  return avgDaysForStatsMode(stats, statsMode, orderType);
}

export { combinedAvgDays, mainAvgDays, sideAvgDays, totalSampleCount };

export function sampleCountForOrderType(
  stats: DeliveryStats | null | undefined,
  orderType: OrderType,
  statsMode: StatsMode
): number {
  if (!stats) return 0;
  if (statsMode === "LACZNIE") {
    return (stats.main_count ?? 0) + (stats.side_count ?? 0);
  }
  if (orderType === "Glowne") return stats.main_count ?? 0;
  if (orderType === "Poboczne") return stats.side_count ?? 0;
  return (stats.main_count ?? 0) + (stats.side_count ?? 0);
}

export type DeliveryEtaEstimate = {
  avgBusinessDays: number;
  expectedDate: Date;
  sampleCount: number;
  lowConfidence: boolean;
};

/** Szacunek na podstawie średnich czasów realizacji u dostawcy (dni robocze). */
export function estimateDeliveryEta(
  startAt: string,
  stats: DeliveryStats | null | undefined,
  orderType: OrderType,
  statsMode: StatsMode
): DeliveryEtaEstimate | null {
  const avg = avgDaysForOrderType(stats, orderType, statsMode);
  const start = parseDateOnly(startAt);
  if (!start || avg == null || avg <= 0) return null;

  const sampleCount = sampleCountForOrderType(stats, orderType, statsMode);
  return {
    avgBusinessDays: Math.round(avg),
    expectedDate: calculateBusinessDate(start, Math.round(avg)),
    sampleCount,
    lowConfidence: sampleCount < 3,
  };
}

export function formatEtaLabel(estimate: DeliveryEtaEstimate): string {
  const date = formatDateString(estimate.expectedDate, "dd.MM.yyyy");
  const conf = estimate.lowConfidence ? MY_ORDER_HISTORY_ESTIMATE_LOW_CONFIDENCE_SUFFIX : "";
  return `ok. ${date} · ~${estimate.avgBusinessDays} dni rob.${conf}`;
}

export function isPastExpectedDate(expectedDate: Date): boolean {
  return toDateOnly(expectedDate).getTime() < todayInWarsaw().getTime();
}

export type SupplierLeadTimeHint = {
  lines: string[];
  lowConfidence: boolean;
  hasData: boolean;
};

/** Tekst podpowiedzi przy wyborze dostawcy (formularz / panel). */
export function buildSupplierLeadTimeHint(
  stats: DeliveryStats | null | undefined,
  statsMode: StatsMode,
  options?: { orderType?: OrderType; fromPlacementDate?: Date }
): SupplierLeadTimeHint {
  const sampleCount = totalSampleCount(stats);
  const lowConfidence = sampleCount > 0 && sampleCount < 3;
  const lines: string[] = [];

  if (!stats || sampleCount === 0) {
    return {
      lines: ["Brak historii realizacji u tego dostawcy — termin ustalimy po pierwszych dostawach."],
      lowConfidence: true,
      hasData: false,
    };
  }

  if (statsMode === "LACZNIE") {
    const avg = combinedAvgDays(stats);
    if (avg != null && avg > 0) {
      lines.push(
        `Średnio od zamówienia u dostawcy towar dociera po ~${avg} ${daysLabel(avg)} (na podstawie ${sampleCount} ${deliveriesLabel(sampleCount)}).`
      );
    }
  } else {
    const main = mainAvgDays(stats);
    const side = sideAvgDays(stats);
    if (main != null && main > 0) {
      lines.push(
        `Planowa dostawa (główne): ~${main} ${daysLabel(main)}${stats.main_count ? ` · ${stats.main_count} prób` : ""}.`
      );
    }
    if (side != null && side > 0) {
      lines.push(
        `Domówienie (poboczne): ~${side} ${daysLabel(side)}${stats.side_count ? ` · ${stats.side_count} prób` : ""}.`
      );
    }
    if (!lines.length) {
      lines.push("Brak osobnych średnich dla głównych / pobocznych — sprawdź statystyki dostawcy.");
    }
  }

  const orderType = options?.orderType;
  if (orderType && orderType !== "None" && options?.fromPlacementDate) {
    const eta = estimateDeliveryEta(
      options.fromPlacementDate.toISOString(),
      stats,
      orderType,
      statsMode
    );
    if (eta) {
      const kind =
        statsMode === "LACZNIE"
          ? "Szacowana dostawa po zamówieniu"
          : orderType === "Glowne"
            ? "po zamówieniu głównym"
            : "po domówieniu pobocznym";
      lines.push(`${kind}: ${formatEtaLabel(eta)}`);
    }
  }

  if (lowConfidence) {
    lines.push("Szacunek z małą liczbą dostaw w historii — może się zmieniać.");
  }

  return { lines, lowConfidence, hasData: true };
}

/** Jedna krótka linia na karcie panelu dziennego (bez rozwijania szczegółów). */
export function formatSupplierLeadTimeBrief(
  stats: DeliveryStats | null | undefined,
  statsMode: StatsMode
): string | null {
  if (!stats || totalSampleCount(stats) === 0) return null;
  const low = totalSampleCount(stats) < 3 ? " · szacunek" : "";

  if (statsMode === "LACZNIE") {
    const avg = combinedAvgDays(stats);
    if (avg == null || avg <= 0) return null;
    const n = Math.round(avg);
    return `~${n} ${n === 1 ? "dzień" : "dni"} rob.${low}`;
  }

  const parts: string[] = [];
  const main = mainAvgDays(stats);
  if (main != null && main > 0) parts.push(`gł. ~${Math.round(main)} d`);
  const side = sideAvgDays(stats);
  if (side != null && side > 0) parts.push(`pob. ~${Math.round(side)} d`);
  if (!parts.length) return null;
  return `${parts.join(" · ")}${low}`;
}

/** Które warianty szacunku pokazać w panelu (bez duplikatów przy trybie łącznym). */
export function orderTypesForLeadTimeHints(
  stats: DeliveryStats | null | undefined,
  statsMode: StatsMode
): ("Glowne" | "Poboczne")[] {
  if (!stats) return [];
  if (statsMode === "LACZNIE") return ["Glowne"];
  const types: ("Glowne" | "Poboczne")[] = [];
  if (mainAvgDays(stats) != null) types.push("Glowne");
  if (sideAvgDays(stats) != null) types.push("Poboczne");
  return types.length ? types : ["Glowne", "Poboczne"];
}

function daysLabel(n: number): string {
  if (n === 1) return "dnia roboczego";
  return "dni roboczych";
}

function daysLabelShort(n: number): string {
  if (n === 1) return "dzień roboczy";
  if (n >= 2 && n <= 4) return "dni robocze";
  return "dni roboczych";
}

function deliveriesLabel(n: number): string {
  if (n === 1) return "dostawy";
  if (n >= 2 && n <= 4) return "dostaw";
  return "dostaw";
}

function deliveriesCountLabel(n: number): string {
  if (n === 1) return "1 dostawa";
  if (n >= 2 && n <= 4) return `${n} dostawy`;
  return `${n} dostaw`;
}

export type SupplierDrawerLeadTimePart = {
  avgDays: number;
  /** np. "~8" */
  avgDisplay: string;
  unitLabel: string;
  sampleLabel: string;
};

export type SupplierDrawerLeadTimeModel =
  | {
      kind: "empty";
      title: string;
      detail: string;
    }
  | {
      kind: "combined";
      title: string;
      primary: SupplierDrawerLeadTimePart;
      sampleLabel: string;
      modeLabel: string;
      lowConfidence: boolean;
      footnote: string | null;
    }
  | {
      kind: "split";
      title: string;
      main: SupplierDrawerLeadTimePart | null;
      side: SupplierDrawerLeadTimePart | null;
      sampleLabel: string;
      modeLabel: string;
      lowConfidence: boolean;
      footnote: string | null;
    };

/**
 * Model karty „Średni czas dostawy” w podglądzie dostawcy (panel dzienny).
 * Dane z `delivery_stats` + `stats_mode` dostawcy — bez dodatkowego fetcha.
 */
export function buildSupplierDrawerLeadTime(
  stats: DeliveryStats | null | undefined,
  statsMode: StatsMode
): SupplierDrawerLeadTimeModel {
  const title = "Średni czas dostawy";
  const sampleCount = totalSampleCount(stats);
  const lowConfidence = sampleCount > 0 && sampleCount < 3;
  const footnote = lowConfidence
    ? "Mało dostaw w historii — szacunek może się zmieniać."
    : null;

  if (!stats || sampleCount === 0) {
    return {
      kind: "empty",
      title,
      detail: "Brak historii — średnia pojawi się po pierwszych dostawach.",
    };
  }

  if (statsMode === "LACZNIE") {
    const avg = combinedAvgDays(stats);
    if (avg == null || avg <= 0) {
      return {
        kind: "empty",
        title,
        detail: "Brak wiarygodnej średniej w statystykach dostaw.",
      };
    }
    const n = Math.round(avg);
    return {
      kind: "combined",
      title,
      primary: {
        avgDays: n,
        avgDisplay: `~${n}`,
        unitLabel: daysLabelShort(n),
        sampleLabel: deliveriesCountLabel(sampleCount),
      },
      sampleLabel: `Na podstawie ${deliveriesCountLabel(sampleCount)}`,
      modeLabel: "łącznie",
      lowConfidence,
      footnote,
    };
  }

  const mainAvg = mainAvgDays(stats);
  const sideAvg = sideAvgDays(stats);
  const main =
    mainAvg != null && mainAvg > 0 && (stats.main_count ?? 0) > 0
      ? {
          avgDays: Math.round(mainAvg),
          avgDisplay: `~${Math.round(mainAvg)}`,
          unitLabel: daysLabelShort(Math.round(mainAvg)),
          sampleLabel: deliveriesCountLabel(stats.main_count ?? 0),
        }
      : null;
  const side =
    sideAvg != null && sideAvg > 0 && (stats.side_count ?? 0) > 0
      ? {
          avgDays: Math.round(sideAvg),
          avgDisplay: `~${Math.round(sideAvg)}`,
          unitLabel: daysLabelShort(Math.round(sideAvg)),
          sampleLabel: deliveriesCountLabel(stats.side_count ?? 0),
        }
      : null;

  if (!main && !side) {
    return {
      kind: "empty",
      title,
      detail: "Brak osobnych średnich dla zamówień głównych / pobocznych.",
    };
  }

  return {
    kind: "split",
    title,
    main,
    side,
    sampleLabel: `Na podstawie ${deliveriesCountLabel(sampleCount)}`,
    modeLabel: "osobno",
    lowConfidence,
    footnote,
  };
}

export function formatActualDeliveryDays(actionAt: string, deliveryAt: string): string | null {
  const start = parseDateOnly(actionAt);
  const end = parseDateOnly(deliveryAt);
  if (!start || !end) return null;
  const days = calculateBusinessDays(start, end);
  if (days <= 0) return "tego samego dnia roboczego";
  if (days === 1) return "1 dzień roboczy";
  return `${days} dni roboczych`;
}
