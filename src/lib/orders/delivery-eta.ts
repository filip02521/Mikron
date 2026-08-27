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
import { todayInWarsaw, warsawDateKeyFromIso } from "@/lib/time/warsaw";
import { isDeliveryEtaUseP50EnabledSync } from "@/lib/env/delivery-stats-flags";

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

export type DeliveryEtaVariability = "stable" | "wide";

/** Wspólny kontrakt ETA — moje / plan / drawer / ZD overdue. */
export type DeliveryEtaEstimate = {
  /** Średnia (mean) z delivery_stats — zawsze zachowana do diagnostyki. */
  avgBusinessDays: number;
  /**
   * Dni robocze użyte do expectedDate i etykiet (mean albo p50 wg flagi).
   * Zawsze zgodne z datą kalendarzową.
   */
  primaryBusinessDays: number;
  /** Data używana jako primary ETA (mean albo p50 wg flagi). */
  expectedDate: Date;
  sampleCount: number;
  /** Liczba unikalnych dni zamówienia (waga mean) — opcjonalnie z samples. */
  placementDayCount?: number;
  lowConfidence: boolean;
  p50BusinessDays?: number;
  p90BusinessDays?: number;
  firstReceiptP50Days?: number;
  variability?: DeliveryEtaVariability;
  nextMorningShare?: number;
  /** true gdy primaryBusinessDays === 0 (dostawa tego samego dnia roboczego). */
  sameDay?: boolean;
};

/** Opcje wyświetlania lead-time (brief / drawer / prośba) — spójne z ETA_USE_P50. */
export type LeadTimeDisplayOptions = {
  useP50?: boolean;
  /** p50 dla trybu LACZNIE (wszystkie typy). */
  p50Combined?: number | null;
  p50Main?: number | null;
  p50Side?: number | null;
  nOrders?: number | null;
  variability?: DeliveryEtaVariability | null;
  hasRecentSample?: boolean | null;
};

function resolveDisplayDays(
  meanDays: number,
  p50: number | null | undefined,
  useP50: boolean
): number {
  if (useP50 && p50 != null && Number.isFinite(p50)) {
    return Math.round(p50);
  }
  return Math.round(meanDays);
}

export type EstimateDeliveryEtaOptions = {
  /** Override flagi ETA_USE_P50 (testy). */
  useP50?: boolean;
  p50BusinessDays?: number | null;
  p90BusinessDays?: number | null;
  firstReceiptP50Days?: number | null;
  placementDayCount?: number | null;
  /** n_orders z samples — preferowane nad count z delivery_stats. */
  nOrders?: number | null;
  variability?: DeliveryEtaVariability | null;
  nextMorningShare?: number | null;
  /** Świeżość: brak próbki < 90 dni → lowConfidence. */
  hasRecentSample?: boolean | null;
};

/** Placement day-only w Warszawie (ISO pełne lub YYYY-MM-DD). */
export function etaPlacementDateOnly(startAt: string): Date | null {
  const raw = startAt.trim();
  if (!raw) return null;
  const key = raw.length === 10 ? raw : warsawDateKeyFromIso(raw);
  return parseDateOnly(key);
}

function resolvePrimaryBusinessDays(
  meanDays: number,
  options?: EstimateDeliveryEtaOptions
): number {
  const useP50 = options?.useP50 ?? isDeliveryEtaUseP50EnabledSync();
  if (useP50 && options?.p50BusinessDays != null && Number.isFinite(options.p50BusinessDays)) {
    return Math.round(options.p50BusinessDays);
  }
  return Math.round(meanDays);
}

export function resolveLowConfidence(input: {
  sampleCount: number;
  variability?: DeliveryEtaVariability | null;
  hasRecentSample?: boolean | null;
}): boolean {
  if (input.sampleCount < 5) return true;
  if (input.variability === "wide") return true;
  if (input.hasRecentSample === false) return true;
  return false;
}

/** Buduje opcje ETA z kwantyli samples (wspólne dla wszystkich czytelników). */
export function estimateOptionsFromQuantiles(
  quantiles:
    | {
        p50: number | null;
        p90: number | null;
        nOrders: number;
        placementDayCount: number;
        firstReceiptP50: number | null;
        variability: DeliveryEtaVariability | null;
        nextMorningShare: number | null;
        hasRecentSample: boolean;
      }
    | null
    | undefined,
  useP50?: boolean
): EstimateDeliveryEtaOptions {
  if (!quantiles) {
    return { useP50: useP50 ?? isDeliveryEtaUseP50EnabledSync() };
  }
  return {
    useP50: useP50 ?? isDeliveryEtaUseP50EnabledSync(),
    p50BusinessDays: quantiles.p50,
    p90BusinessDays: quantiles.p90,
    firstReceiptP50Days: quantiles.firstReceiptP50,
    placementDayCount: quantiles.placementDayCount,
    nOrders: quantiles.nOrders,
    variability: quantiles.variability,
    nextMorningShare: quantiles.nextMorningShare,
    hasRecentSample: quantiles.hasRecentSample,
  };
}

/** Szacunek na podstawie średnich czasów realizacji u dostawcy (dni robocze). */
export function estimateDeliveryEta(
  startAt: string,
  stats: DeliveryStats | null | undefined,
  orderType: OrderType,
  statsMode: StatsMode,
  options?: EstimateDeliveryEtaOptions
): DeliveryEtaEstimate | null {
  const avg = avgDaysForOrderType(stats, orderType, statsMode);
  const start = etaPlacementDateOnly(startAt);
  // avg === 0 (same-day) jest dozwolone; tylko brak / ujemne → null
  if (!start || avg == null || avg < 0) return null;

  const statsSampleCount = sampleCountForOrderType(stats, orderType, statsMode);
  const sampleCount =
    options?.nOrders != null && options.nOrders > 0 ? options.nOrders : statsSampleCount;
  const primaryDays = resolvePrimaryBusinessDays(avg, options);
  if (primaryDays < 0) return null;

  const expectedDate = calculateBusinessDate(start, primaryDays);
  const variability = options?.variability ?? undefined;
  const lowConfidence = resolveLowConfidence({
    sampleCount,
    variability,
    hasRecentSample: options?.hasRecentSample,
  });

  return {
    avgBusinessDays: Math.round(avg),
    primaryBusinessDays: primaryDays,
    expectedDate,
    sampleCount,
    placementDayCount: options?.placementDayCount ?? undefined,
    lowConfidence,
    p50BusinessDays:
      options?.p50BusinessDays != null ? Math.round(options.p50BusinessDays) : undefined,
    p90BusinessDays:
      options?.p90BusinessDays != null && sampleCount >= 5
        ? Math.round(options.p90BusinessDays)
        : undefined,
    firstReceiptP50Days:
      options?.firstReceiptP50Days != null
        ? Math.round(options.firstReceiptP50Days)
        : undefined,
    variability,
    nextMorningShare: options?.nextMorningShare ?? undefined,
    sameDay: primaryDays === 0,
  };
}

export function formatEtaLabel(estimate: DeliveryEtaEstimate): string {
  const date = formatDateString(estimate.expectedDate, "dd.MM.yyyy");
  const conf = estimate.lowConfidence ? MY_ORDER_HISTORY_ESTIMATE_LOW_CONFIDENCE_SUFFIX : "";
  const days = estimate.primaryBusinessDays;
  if (estimate.sameDay || days === 0) {
    return `ok. ${date} · tego samego dnia rob.${conf}`;
  }
  if (days === 1) {
    return `ok. ${date} · ~1 dzień rob. (nazajutrz)${conf}`;
  }
  return `ok. ${date} · ~${days} dni rob.${conf}`;
}

export function isPastExpectedDate(expectedDate: Date): boolean {
  return toDateOnly(expectedDate).getTime() < todayInWarsaw().getTime();
}

/** Overdue z kontraktu ETA (ta sama semantyka co isPastExpectedDate). */
export function isEstimateOverdue(estimate: DeliveryEtaEstimate): boolean {
  return isPastExpectedDate(estimate.expectedDate);
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
  options?: {
    orderType?: OrderType;
    fromPlacementDate?: Date;
  } & LeadTimeDisplayOptions &
    EstimateDeliveryEtaOptions
): SupplierLeadTimeHint {
  const sampleCount =
    options?.nOrders != null && options.nOrders > 0
      ? options.nOrders
      : totalSampleCount(stats);
  const useP50 = options?.useP50 ?? isDeliveryEtaUseP50EnabledSync();
  const lowConfidence = resolveLowConfidence({
    sampleCount,
    variability: options?.variability,
    hasRecentSample: options?.hasRecentSample,
  });
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
    if (avg != null && avg >= 0) {
      const n = resolveDisplayDays(avg, options?.p50Combined ?? options?.p50BusinessDays, useP50);
      const primaryWord = useP50 && options?.p50Combined != null ? "Zwykle" : "Średnio";
      lines.push(
        n === 0
          ? `${primaryWord} towar dociera tego samego dnia roboczego (na podstawie ${sampleCount} ${deliveriesLabel(sampleCount)}).`
          : `${primaryWord} od zamówienia u dostawcy towar dociera po ~${n} ${daysLabel(n)} (na podstawie ${sampleCount} ${deliveriesLabel(sampleCount)}).`
      );
    }
  } else {
    const main = mainAvgDays(stats);
    const side = sideAvgDays(stats);
    if (main != null && main >= 0) {
      const n = resolveDisplayDays(main, options?.p50Main, useP50);
      lines.push(
        n === 0
          ? `Planowa dostawa (główne): tego samego dnia roboczego${stats.main_count ? ` · ${stats.main_count} prób` : ""}.`
          : `Planowa dostawa (główne): ~${n} ${daysLabel(n)}${stats.main_count ? ` · ${stats.main_count} prób` : ""}.`
      );
    }
    if (side != null && side >= 0) {
      const n = resolveDisplayDays(side, options?.p50Side, useP50);
      lines.push(
        n === 0
          ? `Domówienie (poboczne): tego samego dnia roboczego${stats.side_count ? ` · ${stats.side_count} prób` : ""}.`
          : `Domówienie (poboczne): ~${n} ${daysLabel(n)}${stats.side_count ? ` · ${stats.side_count} prób` : ""}.`
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
      statsMode,
      options
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
  statsMode: StatsMode,
  display?: LeadTimeDisplayOptions
): string | null {
  if (!stats || totalSampleCount(stats) === 0) return null;
  const sampleCount =
    display?.nOrders != null && display.nOrders > 0
      ? display.nOrders
      : totalSampleCount(stats);
  const low = resolveLowConfidence({
    sampleCount,
    variability: display?.variability,
    hasRecentSample: display?.hasRecentSample,
  })
    ? " · szacunek"
    : "";
  const useP50 = display?.useP50 ?? isDeliveryEtaUseP50EnabledSync();

  if (statsMode === "LACZNIE") {
    const avg = combinedAvgDays(stats);
    if (avg == null || avg < 0) return null;
    const n = resolveDisplayDays(avg, display?.p50Combined, useP50);
    if (n === 0) return `tego samego dnia rob.${low}`;
    return `~${n} ${n === 1 ? "dzień" : "dni"} rob.${low}`;
  }

  const parts: string[] = [];
  const main = mainAvgDays(stats);
  if (main != null && main >= 0) {
    const n = resolveDisplayDays(main, display?.p50Main, useP50);
    parts.push(n === 0 ? "gł. dziś" : `gł. ~${n} d`);
  }
  const side = sideAvgDays(stats);
  if (side != null && side >= 0) {
    const n = resolveDisplayDays(side, display?.p50Side, useP50);
    parts.push(n === 0 ? "pob. dziś" : `pob. ~${n} d`);
  }
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
  if (n === 0) return "tego samego dnia";
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
 * Model karty czasu dostawy w podglądzie dostawcy (panel dzienny).
 * Przy ETA_USE_P50 primary = mediana z samples; mean zostaje w footnote gdy różni się.
 */
export function buildSupplierDrawerLeadTime(
  stats: DeliveryStats | null | undefined,
  statsMode: StatsMode,
  display?: LeadTimeDisplayOptions
): SupplierDrawerLeadTimeModel {
  const useP50 = display?.useP50 ?? isDeliveryEtaUseP50EnabledSync();
  const title = useP50 ? "Typowy czas dostawy" : "Średni czas dostawy";
  const sampleCount =
    display?.nOrders != null && display.nOrders > 0
      ? display.nOrders
      : totalSampleCount(stats);
  const lowConfidence = resolveLowConfidence({
    sampleCount,
    variability: display?.variability,
    hasRecentSample: display?.hasRecentSample,
  });
  let footnote = lowConfidence
    ? "Mało dostaw w historii — szacunek może się zmieniać."
    : null;

  if (!stats || totalSampleCount(stats) === 0) {
    return {
      kind: "empty",
      title,
      detail: "Brak historii — średnia pojawi się po pierwszych dostawach.",
    };
  }

  if (statsMode === "LACZNIE") {
    const avg = combinedAvgDays(stats);
    if (avg == null || avg < 0) {
      return {
        kind: "empty",
        title,
        detail: "Brak wiarygodnej średniej w statystykach dostaw.",
      };
    }
    const meanN = Math.round(avg);
    const n = resolveDisplayDays(avg, display?.p50Combined, useP50);
    if (useP50 && display?.p50Combined != null && meanN !== n && !footnote) {
      footnote = `Mediana · średnia ~${meanN} ${daysLabelShort(meanN)}`;
    } else if (useP50 && display?.p50Combined != null && meanN !== n && footnote) {
      footnote = `${footnote} Mediana · średnia ~${meanN}.`;
    }
    return {
      kind: "combined",
      title,
      primary: {
        avgDays: n,
        avgDisplay: n === 0 ? "0" : `~${n}`,
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
  const mainN =
    mainAvg != null && mainAvg >= 0
      ? resolveDisplayDays(mainAvg, display?.p50Main, useP50)
      : null;
  const sideN =
    sideAvg != null && sideAvg >= 0
      ? resolveDisplayDays(sideAvg, display?.p50Side, useP50)
      : null;
  const main =
    mainN != null && (stats.main_count ?? 0) > 0
      ? {
          avgDays: mainN,
          avgDisplay: mainN === 0 ? "0" : `~${mainN}`,
          unitLabel: daysLabelShort(mainN),
          sampleLabel: deliveriesCountLabel(stats.main_count ?? 0),
        }
      : null;
  const side =
    sideN != null && (stats.side_count ?? 0) > 0
      ? {
          avgDays: sideN,
          avgDisplay: sideN === 0 ? "0" : `~${sideN}`,
          unitLabel: daysLabelShort(sideN),
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
  const start = etaPlacementDateOnly(actionAt);
  const end = etaPlacementDateOnly(deliveryAt);
  if (!start || !end) return null;
  const days = calculateBusinessDays(start, end);
  if (days <= 0) return "tego samego dnia roboczego";
  if (days === 1) return "1 dzień roboczy";
  return `${days} dni roboczych`;
}
