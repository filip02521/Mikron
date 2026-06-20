import { addDays } from "date-fns";
import { formatDateString, parseDateOnly, toDateOnly } from "@/lib/orders/dates";
import { MY_ORDER_HISTORY_ESTIMATE_OVERDUE_META_TITLE, MY_ORDER_HISTORY_ESTIMATE_TITLE } from "@/lib/orders/my-order-history-estimate-copy";
import { todayInWarsaw } from "@/lib/time/warsaw";

const WEEKDAY_LABELS = ["Niedz", "Pon", "Wt", "Śr", "Czw", "Pt", "Sob"];

export type DeliveryDateMetaDisplay = {
  primaryLabel: string;
  detailLabel: string | null;
  overdue: boolean;
  title: string;
};

function dateKeyOffset(fromDateKey: string, dayOffset: number): string | null {
  const base = parseDateOnly(fromDateKey);
  if (!base) return null;
  return formatDateString(addDays(base, dayOffset));
}

function weekdayShort(date: Date): string {
  return WEEKDAY_LABELS[date.getDay()] ?? "";
}

/** Czytelna etykieta daty dostawy na zwiniętej karcie /moje. */
export function buildDeliveryDateMetaDisplay(
  expectedDate: Date,
  options?: {
    todayDateKey?: string;
    avgBusinessDays?: number | null;
    lowConfidence?: boolean;
  }
): DeliveryDateMetaDisplay {
  const target = toDateOnly(expectedDate);
  const todayStr = options?.todayDateKey ?? formatDateString(todayInWarsaw());
  const targetKey = formatDateString(target);
  const shortDate = formatDateString(target, "dd.MM");
  const longDate = formatDateString(target, "dd.MM.yyyy");
  const overdue = targetKey < todayStr;

  const estimateDetail = [
    options?.avgBusinessDays != null && options.avgBusinessDays > 0
      ? `~${options.avgBusinessDays} dni rob.`
      : null,
    options?.lowConfidence ? "mało historii" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  if (overdue) {
    return {
      primaryLabel: "Po terminie",
      detailLabel: longDate,
      overdue: true,
      title: `Termin dostawy minął ${longDate}`,
    };
  }

  if (targetKey === todayStr) {
    return {
      primaryLabel: "Dziś",
      detailLabel: shortDate,
      overdue: false,
      title: `Planowana dostawa dziś · ${longDate}`,
    };
  }

  const tomorrowKey = dateKeyOffset(todayStr, 1);
  if (tomorrowKey && targetKey === tomorrowKey) {
    return {
      primaryLabel: "Jutro",
      detailLabel: shortDate,
      overdue: false,
      title: `Planowana dostawa jutro · ${longDate}`,
    };
  }

  const dayAfterKey = dateKeyOffset(todayStr, 2);
  if (dayAfterKey && targetKey === dayAfterKey) {
    return {
      primaryLabel: "Pojutrze",
      detailLabel: shortDate,
      overdue: false,
      title: `Planowana dostawa pojutrze · ${longDate}`,
    };
  }

  const weekday = weekdayShort(target);
  const withinTwoWeeks =
    Math.abs(
      (target.getTime() - (parseDateOnly(todayStr)?.getTime() ?? target.getTime())) /
        (24 * 60 * 60 * 1000)
    ) <= 14;

  if (withinTwoWeeks && weekday) {
    return {
      primaryLabel: `${weekday} ${shortDate}`,
      detailLabel: estimateDetail || null,
      overdue: false,
      title: `Planowana dostawa ${weekday} ${longDate}`,
    };
  }

  return {
    primaryLabel: longDate,
    detailLabel: estimateDetail || null,
    overdue: false,
    title: `Planowana dostawa ${longDate}`,
  };
}

export const MY_ORDER_HISTORY_ESTIMATE_OVERDUE_LABEL =
  "Brak informacji o planowanej dostawie";

/** Meta daty dla szacunku z historii — po terminie bez powtarzania „Po terminie”. */
export function buildHistoryEstimateDateMetaDisplay(
  expectedDate: Date,
  options?: {
    todayDateKey?: string;
    avgBusinessDays?: number | null;
    lowConfidence?: boolean;
  }
): DeliveryDateMetaDisplay {
  const display = buildDeliveryDateMetaDisplay(expectedDate, options);
  if (!display.overdue) {
    return {
      ...display,
      title: `${MY_ORDER_HISTORY_ESTIMATE_TITLE} · ${display.primaryLabel}`,
    };
  }
  return {
    primaryLabel: MY_ORDER_HISTORY_ESTIMATE_OVERDUE_LABEL,
    detailLabel: null,
    overdue: true,
    title: MY_ORDER_HISTORY_ESTIMATE_OVERDUE_META_TITLE,
  };
}

const AVG_DAYS = /\(~(\d+)\s*dni\s*rob\.\)/i;

/** Wyciąga datę i metadane szacunku z timingLabel presentera. */
export function parseDeliveryEstimateFromTimingLabel(timingLabel: string): {
  expectedDate: Date | null;
  avgBusinessDays: number | null;
  lowConfidence: boolean;
  overdue: boolean;
} {
  const overdue = /·\s*po terminie/i.test(timingLabel);
  const lowConfidence = /mało historii/i.test(timingLabel);
  const avgMatch = timingLabel.match(AVG_DAYS);
  const avgBusinessDays = avgMatch?.[1] ? Number.parseInt(avgMatch[1], 10) : null;

  const dateMatch = timingLabel.match(/(\d{2})\.(\d{2})\.(\d{4})/);
  const expectedDate = dateMatch
    ? parseDateOnly(`${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`)
    : null;

  return { expectedDate, avgBusinessDays, lowConfidence, overdue };
}

export const ZD_TIMING_LABEL = /^do\s+\d{2}\.\d{2}\.\d{4}\s*·/i;

function isHistoryTimingLabel(raw: string): boolean {
  return (
    !/^E-mail\s/i.test(raw) &&
    !/^Zamówione\s/i.test(raw) &&
    !ZD_TIMING_LABEL.test(raw)
  );
}

/** Szacunek z historii na poziomie pozycji (niezależnie od grupowego ZD). */
export function resolveLineHistoryEstimateFromTimingLabel(
  timingLabel: string | null | undefined,
  state: {
    zdFulfillment?: { deadline: string } | null;
    zdEtaPending?: boolean;
    zdEtaNoMatch?: boolean;
  }
): {
  label: string;
  lowConfidence: boolean;
  display: DeliveryDateMetaDisplay;
} | null {
  if (state.zdFulfillment) return null;
  if (!state.zdEtaPending && !state.zdEtaNoMatch) return null;
  const raw = timingLabel?.trim();
  if (!raw || !isHistoryTimingLabel(raw)) return null;

  const parsed = parseDeliveryEstimateFromTimingLabel(raw);
  if (!parsed.expectedDate) return null;

  const estimate = raw
    .replace(/\s*·\s*po terminie\s*/gi, "")
    .replace(/\s*·\s*mało historii\s*/gi, "")
    .trim();
  if (!estimate) return null;

  return {
    label: estimate,
    lowConfidence: parsed.lowConfidence,
    display: buildHistoryEstimateDateMetaDisplay(parsed.expectedDate, {
      avgBusinessDays: parsed.avgBusinessDays,
      lowConfidence: parsed.lowConfidence,
    }),
  };
}

/** Szacunek terminu z historii dostaw (timingLabel bez dopasowanego ZD). */
export function resolveMyOrderHistoryDeliveryEstimate(row: {
  timingLabel?: string | null;
  zdFulfillment?: { deadline: string } | null;
}): {
  display: DeliveryDateMetaDisplay;
  parsed: ReturnType<typeof parseDeliveryEstimateFromTimingLabel>;
} | null {
  if (row.zdFulfillment) return null;
  const raw = row.timingLabel?.trim();
  if (!raw || !isHistoryTimingLabel(raw)) return null;

  const parsed = parseDeliveryEstimateFromTimingLabel(raw);
  if (!parsed.expectedDate) return null;

  return {
    parsed,
    display: buildHistoryEstimateDateMetaDisplay(parsed.expectedDate, {
      avgBusinessDays: parsed.avgBusinessDays,
      lowConfidence: parsed.lowConfidence,
    }),
  };
}
