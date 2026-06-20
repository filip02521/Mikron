import type { MyOrderRow } from "@/lib/orders/my-order-presenter";
import { formatPlDate } from "@/lib/display-labels";
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
  resolveMyOrderDeliveryUrgency,
  type DeliveryUrgency,
} from "@/lib/orders/my-order-delivery-urgency";
import { zdFulfillmentSlots } from "@/lib/orders/my-order-zd-fulfillment-display";

/** Sekcja „Potwierdź odbiór” — bez planowanej dostawy (towar już dotarł lub czeka na zamknięcie). */
export function shouldShowMyOrderCollapsedDeliveryTiming(
  row: Pick<
    MyOrderRow,
    | "acknowledgeMode"
    | "pickupPendingCount"
    | "cancelledAckOrderIds"
    | "cancelNoticeOrderIds"
  >
): boolean {
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
  const synced = zd.syncedAt ? formatPlDate(zd.syncedAt.slice(0, 10)) : null;
  const dokNrInEstimate = estimateMentionsZdDocNumber(estimate, zd.dokNr);
  if (synced) {
    return dokNrInEstimate ? `zaktualizowano ${synced}` : `${zd.dokNr} · zaktualizowano ${synced}`;
  }
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
    detail:
      meta.urgency === "overdue"
        ? meta.detailLabel ?? display.detail
        : display.detail ?? meta.detailLabel,
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
        title: "Sprawdzamy termin w ZD",
        estimate: MY_ORDER_HISTORY_ESTIMATE_OVERDUE_LABEL,
        detail: MY_ORDER_HISTORY_ESTIMATE_OVERDUE_ZD_PENDING_DETAIL,
        tone: "overdue",
        urgency: "overdue",
        urgencyLabel: null,
      };
    }
    const statEstimate = raw ? parseMyOrderTimingLabel(raw).estimate : null;
    return {
      title: "Sprawdzamy termin w ZD",
      estimate: statEstimate ?? "Trwa synchronizacja z Subiektem…",
      detail: statEstimate
        ? MY_ORDER_HISTORY_ESTIMATE_ZD_PENDING_REPLACE_DETAIL
        : "Szukamy dokumentu ZD u dostawcy w Subiekcie.",
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
    const zdEstimate = estimate || `do ${formatPlDate(zd.deadline)} · ${zd.dokNr}`;
    const baseDetail = buildZdFulfillmentDetailLine(zdEstimate, zd, multiSlotDetail);
    const mixedDetail = row.zdEtaNoMatch
      ? [baseDetail, MY_ORDER_HISTORY_ESTIMATE_MIXED_ZD_GROUP_DETAIL].filter(Boolean).join(" · ")
      : row.zdEtaPending
        ? [baseDetail, "Część pozycji czeka na synchronizację ZD w Subiekcie."]
            .filter(Boolean)
            .join(" · ")
        : baseDetail;
    return withUrgency(
      {
        title: overdue ? "Planowana dostawa po terminie" : "Planowana dostawa z dokumentu ZD",
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
        title: "Brak terminu w Subiekcie",
        estimate: MY_ORDER_HISTORY_ESTIMATE_OVERDUE_LABEL,
        detail: MY_ORDER_HISTORY_ESTIMATE_OVERDUE_ZD_NO_MATCH_DETAIL,
        tone: "overdue",
        urgency: "overdue",
        urgencyLabel: null,
      };
    }
    return withUrgency(
      {
        title: "Brak terminu w Subiekcie",
        estimate: historyEstimateText || "Brak terminu w ZD",
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
  if (!shouldShowMyOrderCollapsedDeliveryTiming(row)) return false;
  if (!showProgress || row.kind !== "zamowienie") return false;
  if (
    !row.timingLabel?.trim() &&
    !row.zdEtaPending &&
    !row.zdEtaNoMatch &&
    !row.zdFulfillment
  ) {
    return false;
  }
  if (row.statusTitle === "Do odbioru" || row.statusTitle === "Anulowane") return false;
  return buildMyOrderDeliveryTimingDisplay(row) !== null;
}
