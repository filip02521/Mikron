import {
  buildDeliveryDateMetaDisplay,
  type DeliveryDateMetaDisplay,
} from "@/lib/orders/delivery-date-meta-label";
import { formatDateString, parseDateOnly, toDateOnly } from "@/lib/orders/dates";
import { orderPlacementAt } from "@/lib/orders/order-timing";
import type { IndividualOrder } from "@/types/database";

/** Krótka etykieta na karcie /moje i w modalu ZK. */
export const ZD_FULFILLMENT_PLACEHOLDER_PRIMARY_LABEL = "Ustalamy termin dostawy";

/** Drugi wiersz meta na karcie /moje — mieści się w ~46% szerokości wiersza. */
export const ZD_FULFILLMENT_PLACEHOLDER_DETAIL = "Potwierdzanie terminu";

/** Jedna fraza w meta prośby (modal ZK) i timingLabel na /moje. */
export const ZD_FULFILLMENT_PLACEHOLDER_ZK_META = "Ustalamy termin dostawy";

export const ZD_FULFILLMENT_PLACEHOLDER_TITLE =
  "Zamówienie złożone u dostawcy — data w ZD to tymczasowy zapis z dnia złożenia. Dział dostaw zaktualizuje termin po odpowiedzi dostawcy.";

export const ZD_FULFILLMENT_PLACEHOLDER_BADGE = "Czekamy na termin";

export const ZD_FULFILLMENT_PLACEHOLDER_TIMING_LABEL = "Ustalamy termin dostawy";

export function normalizeOrderDateKey(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  const parsed = parseDateOnly(value.trim().slice(0, 10));
  return parsed ? formatDateString(parsed) : null;
}

/**
 * Termin ZD równy dniu złożenia zamówienia u dostawcy i bez późniejszej korekty —
 * typowy placeholder z Subiekta, nie realna data dostawy dla handlowca.
 */
export function isPlaceholderZdFulfillmentDeadline(input: {
  deadline: string | null | undefined;
  placementAt: string | null | undefined;
  deadlineChangedAt?: string | null;
}): boolean {
  if (input.deadlineChangedAt?.trim()) return false;
  const deadlineKey = normalizeOrderDateKey(input.deadline);
  const placementKey = normalizeOrderDateKey(input.placementAt);
  if (!deadlineKey || !placementKey) return false;
  return deadlineKey === placementKey;
}

export function resolvePlaceholderZdFulfillmentDeadlineFromOrder(
  order: Pick<
    IndividualOrder,
    | "zd_fulfillment_deadline"
    | "ordered_at"
    | "action_at"
    | "status"
    | "zd_fulfillment_deadline_changed_at"
  >
): boolean {
  return isPlaceholderZdFulfillmentDeadline({
    deadline: order.zd_fulfillment_deadline,
    placementAt: orderPlacementAt(order),
    deadlineChangedAt: order.zd_fulfillment_deadline_changed_at,
  });
}

export function buildPlaceholderZdDeliveryDateMetaDisplay(): DeliveryDateMetaDisplay {
  return {
    primaryLabel: ZD_FULFILLMENT_PLACEHOLDER_PRIMARY_LABEL,
    detailLabel: ZD_FULFILLMENT_PLACEHOLDER_DETAIL,
    overdue: false,
    title: ZD_FULFILLMENT_PLACEHOLDER_TITLE,
  };
}

/** Meta daty ZD — ukrywa placeholder „dziś = dzień zamówienia” przed korektą działu dostaw. */
export function buildZdDeliveryDateMetaDisplay(
  expectedDate: Date,
  options?: {
    todayDateKey?: string;
    placementAt?: string | null;
    deadlineChangedAt?: string | null;
    avgBusinessDays?: number | null;
    lowConfidence?: boolean;
  }
): DeliveryDateMetaDisplay {
  const targetKey = formatDateString(toDateOnly(expectedDate));
  if (
    isPlaceholderZdFulfillmentDeadline({
      deadline: targetKey,
      placementAt: options?.placementAt,
      deadlineChangedAt: options?.deadlineChangedAt,
    })
  ) {
    return buildPlaceholderZdDeliveryDateMetaDisplay();
  }
  return buildDeliveryDateMetaDisplay(expectedDate, options);
}
