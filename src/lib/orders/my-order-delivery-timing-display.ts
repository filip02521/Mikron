import type { MyOrderRow } from "@/lib/orders/my-order-presenter";
import { formatPlDate } from "@/lib/display-labels";
import { parseDateOnly, formatDateString } from "@/lib/orders/dates";
import {
  MY_ORDER_HISTORY_ESTIMATE_OVERDUE_LABEL,
  resolveMyOrderHistoryDeliveryEstimate,
} from "@/lib/orders/delivery-date-meta-label";
import {
  MY_ORDER_HISTORY_ESTIMATE_BELOW_ZD_NO_MATCH_DETAIL,
  MY_ORDER_HISTORY_ESTIMATE_LOW_CONFIDENCE_DETAIL,
  MY_ORDER_HISTORY_ESTIMATE_MIXED_ZD_GROUP_DETAIL,
  MY_ORDER_HISTORY_ESTIMATE_OVERDUE_DETAIL,
  MY_ORDER_HISTORY_ESTIMATE_OVERDUE_ZD_NO_MATCH_DETAIL,
  MY_ORDER_HISTORY_ESTIMATE_OVERDUE_ZD_PENDING_DETAIL,
  MY_ORDER_HISTORY_ESTIMATE_TITLE,
  MY_ORDER_HISTORY_ESTIMATE_ZD_PENDING_REPLACE_DETAIL,
} from "@/lib/orders/my-order-history-estimate-copy";
import {
  ZD_ETA_MIXED_GROUP_PENDING_DETAIL,
  ZD_ETA_TIMING_DETAIL_PENDING,
  ZD_ETA_TIMING_SYNC_IN_PROGRESS,
  ZD_ETA_TIMING_TITLE_NO_MATCH,
  ZD_ETA_TIMING_TITLE_PENDING,
} from "@/lib/orders/my-order-zd-eta-copy";
import {
  resolveMyOrderDeliveryUrgency,
  type DeliveryUrgency,
} from "@/lib/orders/my-order-delivery-urgency";
import { zdFulfillmentSlots } from "@/lib/orders/my-order-zd-fulfillment-display";

const WEEKDAY_LABELS = ["Niedz", "Pon", "Wt", "Śr", "Czw", "Pt", "Sob"];

function formatPlDateWithWeekday(iso: string): string {
  const parsed = parseDateOnly(iso);
  if (!parsed) return formatPlDate(iso);
  const weekday = WEEKDAY_LABELS[parsed.getDay()] ?? "";
  const dateStr = formatDateString(parsed, "dd.MM.yyyy");
  return weekday ? `${weekday} ${dateStr}` : dateStr;
}

/** Sekcja „Potwierdź odbiór” — bez planowanej dostawy (towar już dotarł lub czeka na zamknięcie). */
export function shouldShowMyOrderCollapsedDeliveryTiming(
  row: Pick<
    MyOrderRow,
    | "acknowledgeMode"
    | "pickupPendingCount"
    | "cancelledAckOrderIds"
    | "cancelNoticeOrderIds"
    | "zdFulfillment"
  >
): boolean {
  const zd = row.zdFulfillment;
  if (zd?.deadlineChange || zd?.deadline?.trim()) {
    const hideForArrivedPickup =
      (row.acknowledgeMode === "pickup" || row.acknowledgeMode === "availability") &&
      row.pickupPendingCount > 0;
    if (!hideForArrivedPickup) return true;
  }

  if (row.acknowledgeMode === "pickup" && row.pickupPendingCount > 0) return false;
  if (row.acknowledgeMode === "availability" && row.pickupPendingCount > 0) return false;
  if (row.acknowledgeMode === "cancelled" && row.cancelledAckOrderIds.length > 0) {
    return false;
  }
  if (row.acknowledgeMode === "cancel_notice" && row.cancelNoticeOrderIds.length > 0) {
    return false;
  }
  return true;
}

export type MyOrderDeliveryTimingTone =
  | "default"
  | "overdue"
  | "low-confidence"
  | "zd-sourced"
  | "today"
  | "tomorrow"
  | "this-week";

export type MyOrderDeliveryTimingDisplay = {
  title: string;
  estimate: string;
  detail: string | null;
  tone: MyOrderDeliveryTimingTone;
  zdDocNumber?: string | null;
  urgency?: DeliveryUrgency;
  urgencyLabel?: string | null;
};

/** Rozbija timingLabel z presentera na czytelne części UI. */
export function parseMyOrderTimingLabel(timingLabel: string): {
  estimate: string;
  overdue: boolean;
  lowConfidence: boolean;
} {
  const overdue = /·\s*po terminie/i.test(timingLabel);
  const lowConfidence = /mało historii/i.test(timingLabel);
  const estimate = timingLabel
    .replace(/\s*·\s*po terminie\s*/gi, "")
    .replace(/\s*·\s*mało historii\s*/gi, "")
    .trim();

  return { estimate, overdue, lowConfidence };
}

function estimateMentionsZdDocNumber(estimate: string, dokNr: string): boolean {
  const doc = dokNr.trim();
  return Boolean(doc) && estimate.includes(doc);
}

function buildZdFulfillmentDetailLine(
  estimate: string,
  zd: { dokNr: string; syncedAt: string | null },
  multiSlotDetail: string | null
): string | null {
  if (multiSlotDetail) return multiSlotDetail;
  const dokNrInEstimate = estimateMentionsZdDocNumber(estimate, zd.dokNr);
  return dokNrInEstimate ? null : zd.dokNr;
}

function withUrgency(
  display: MyOrderDeliveryTimingDisplay,
  row: MyOrderRow
): MyOrderDeliveryTimingDisplay {
  const meta = resolveMyOrderDeliveryUrgency(row);
  const tone =
    meta.urgency === "overdue"
      ? "overdue"
      : display.tone === "zd-sourced"
        ? "zd-sourced"
        : display.tone === "low-confidence"
          ? "low-confidence"
          : "default";

  const urgencyLabel =
    meta.urgency === "overdue" || meta.urgency === "today" ? meta.shortLabel : null;

  return {
    ...display,
    tone,
    urgency: meta.urgency === "overdue" || meta.urgency === "today" ? meta.urgency : undefined,
    urgencyLabel,
    detail: display.detail ?? meta.detailLabel,
  };
}

export function buildMyOrderDeliveryTimingDisplay(
  row: MyOrderRow
): MyOrderDeliveryTimingDisplay | null {
  const raw = row.timingLabel?.trim();
  const zd = row.zdFulfillment;

  if (row.zdEtaPending && !zd) {
    const historyEstimate = resolveMyOrderHistoryDeliveryEstimate(row);
    if (historyEstimate?.display.overdue) {
      return {
        title: ZD_ETA_TIMING_TITLE_PENDING,
        estimate: MY_ORDER_HISTORY_ESTIMATE_OVERDUE_LABEL,
        detail: MY_ORDER_HISTORY_ESTIMATE_OVERDUE_ZD_PENDING_DETAIL,
        tone: "overdue",
        urgency: "overdue",
        urgencyLabel: null,
      };
    }
    const statEstimate = raw ? parseMyOrderTimingLabel(raw).estimate : null;
    return {
      title: ZD_ETA_TIMING_TITLE_PENDING,
      estimate: statEstimate ?? ZD_ETA_TIMING_SYNC_IN_PROGRESS,
      detail: statEstimate
        ? MY_ORDER_HISTORY_ESTIMATE_ZD_PENDING_REPLACE_DETAIL
        : ZD_ETA_TIMING_DETAIL_PENDING,
      tone: "low-confidence",
    };
  }

  if (!raw && !zd && !row.zdEtaNoMatch) return null;

  const { estimate, overdue, lowConfidence } = raw
    ? parseMyOrderTimingLabel(raw)
    : { estimate: "", overdue: false, lowConfidence: false };

  if (zd) {
    const slots = zdFulfillmentSlots(zd);
    const multiSlotDetail =
      slots.length > 1
        ? `${slots.length} terminy: ${slots.map((s) => formatPlDate(s.deadline)).join(" · ")}`
        : null;
    const zdEstimate = estimate || `${formatPlDateWithWeekday(zd.deadline)} · ${zd.dokNr}`;
    const baseDetail = buildZdFulfillmentDetailLine(zdEstimate, zd, multiSlotDetail);
    const mixedDetail = row.zdEtaNoMatch
      ? [baseDetail, MY_ORDER_HISTORY_ESTIMATE_MIXED_ZD_GROUP_DETAIL].filter(Boolean).join(" · ")
      : row.zdEtaPending
        ? [baseDetail, ZD_ETA_MIXED_GROUP_PENDING_DETAIL].filter(Boolean).join(" · ")
        : baseDetail;
    return withUrgency(
      {
        title: overdue ? "Planowana dostawa po terminie" : "Planowana dostawa:",
        estimate: zdEstimate,
        detail: mixedDetail,
        tone: overdue ? "overdue" : "zd-sourced",
        zdDocNumber: zd.dokNr,
      },
      row
    );
  }

  if (row.zdEtaNoMatch) {
    const historyEstimate = resolveMyOrderHistoryDeliveryEstimate(row);
    const historyEstimateText =
      historyEstimate?.display.overdue
        ? MY_ORDER_HISTORY_ESTIMATE_OVERDUE_LABEL
        : historyEstimate
          ? historyEstimate.display.detailLabel
            ? `${historyEstimate.display.primaryLabel} · ${historyEstimate.display.detailLabel}`
            : historyEstimate.display.primaryLabel
          : estimate;
    if (historyEstimate?.display.overdue || overdue) {
      return {
        title: ZD_ETA_TIMING_TITLE_NO_MATCH,
        estimate: MY_ORDER_HISTORY_ESTIMATE_OVERDUE_LABEL,
        detail: MY_ORDER_HISTORY_ESTIMATE_OVERDUE_ZD_NO_MATCH_DETAIL,
        tone: "overdue",
        urgency: "overdue",
        urgencyLabel: null,
      };
    }
    return withUrgency(
      {
        title: ZD_ETA_TIMING_TITLE_NO_MATCH,
        estimate: historyEstimateText || ZD_ETA_TIMING_TITLE_NO_MATCH,
        detail: MY_ORDER_HISTORY_ESTIMATE_BELOW_ZD_NO_MATCH_DETAIL,
        tone: "low-confidence",
      },
      row
    );
  }

  if (!estimate) return null;

  if (overdue) {
    return {
      title: MY_ORDER_HISTORY_ESTIMATE_TITLE,
      estimate: MY_ORDER_HISTORY_ESTIMATE_OVERDUE_LABEL,
      detail: MY_ORDER_HISTORY_ESTIMATE_OVERDUE_DETAIL,
      tone: "overdue",
      urgency: "overdue",
      urgencyLabel: null,
    };
  }

  if (lowConfidence) {
    return withUrgency(
      {
        title: MY_ORDER_HISTORY_ESTIMATE_TITLE,
        estimate,
        detail: MY_ORDER_HISTORY_ESTIMATE_LOW_CONFIDENCE_DETAIL,
        tone: "low-confidence",
      },
      row
    );
  }

  return withUrgency(
    {
      title: MY_ORDER_HISTORY_ESTIMATE_TITLE,
      estimate,
      detail: null,
      tone: "default",
    },
    row
  );
}

/** Blok terminu dla zamówień w toku z ETA lub stanem ZD. */
export function shouldShowMyOrderExpandedDeliveryTiming(
  row: MyOrderRow,
  showProgress: boolean
): boolean {
  if (row.isArchive) return false;
  if (!shouldShowMyOrderCollapsedDeliveryTiming(row)) return false;
  const hasZdData = Boolean(
    row.zdFulfillment || row.zdEtaPending || row.zdEtaNoMatch
  );
  if (row.kind === "informacja" && !hasZdData) return false;
  if (!showProgress && !hasZdData) return false;
  if (
    !row.timingLabel?.trim() &&
    !row.zdEtaPending &&
    !row.zdEtaNoMatch &&
    !row.zdFulfillment
  ) {
    return false;
  }
  if (
    row.statusTitle === "Do odbioru" ||
    row.statusTitle === "Anulowane" ||
    row.statusTitle === "Dostępne" ||
    row.statusTitle === "Anulowano"
  )
    return false;
  return buildMyOrderDeliveryTimingDisplay(row) !== null;
}
