import { formatPlDate } from "@/lib/display-labels";
import { parseDateOnly } from "@/lib/orders/dates";
import type { IndividualOrder } from "@/types/database";

/** Informacja o zmianie widoczna przez 7 dni lub do potwierdzenia. */
export const ZD_FULFILLMENT_DEADLINE_CHANGE_VISIBLE_MS = 7 * 24 * 60 * 60 * 1000;

/** Nagłówek sekcji w UI (caption nad tytułem zmiany). */
export const ZD_FULFILLMENT_DEADLINE_CHANGE_CAPTION = "Zmiana terminu";

export type ZdFulfillmentDeadlineChangeVariant = "postponed" | "moved_earlier";

export type ZdFulfillmentDeadlineChangeDisplay = {
  previousDeadline: string;
  currentDeadline: string;
  changedAt: string;
  variant: ZdFulfillmentDeadlineChangeVariant;
  title: string;
  detail: string;
};

type ZdFulfillmentChangeOrder = Pick<
  IndividualOrder,
  | "zd_fulfillment_deadline"
  | "zd_fulfillment_previous_deadline"
  | "zd_fulfillment_deadline_changed_at"
  | "zd_fulfillment_deadline_change_seen_at"
>;

export function zdFulfillmentDeadlineChangeVariant(
  previousDeadline: string,
  currentDeadline: string
): ZdFulfillmentDeadlineChangeVariant {
  const prev = parseDateOnly(previousDeadline);
  const current = parseDateOnly(currentDeadline);
  if (prev && current && current.getTime() < prev.getTime()) {
    return "moved_earlier";
  }
  return "postponed";
}

export function buildZdFulfillmentDeadlineChangeDisplay(
  previousDeadline: string,
  currentDeadline: string,
  changedAt: string
): ZdFulfillmentDeadlineChangeDisplay {
  const variant = zdFulfillmentDeadlineChangeVariant(previousDeadline, currentDeadline);
  const previousLabel = formatPlDate(previousDeadline);
  const currentLabel = formatPlDate(currentDeadline);
  const title =
    variant === "moved_earlier" ? "Termin przyspieszony" : "Termin przesunięty";
  const detail = `Poprzednio ${previousLabel} · teraz ${currentLabel}`;

  return {
    previousDeadline,
    currentDeadline,
    changedAt,
    variant,
    title,
    detail,
  };
}

export function isZdFulfillmentDeadlineChangeVisible(
  order: ZdFulfillmentChangeOrder,
  at: Date = new Date()
): boolean {
  if (order.zd_fulfillment_deadline_change_seen_at?.trim()) return false;

  const previous = order.zd_fulfillment_previous_deadline?.trim();
  const current = order.zd_fulfillment_deadline?.trim();
  const changedAt = order.zd_fulfillment_deadline_changed_at?.trim();
  if (!previous || !current || !changedAt || previous === current) return false;

  const changedMs = new Date(changedAt).getTime();
  if (!Number.isFinite(changedMs)) return false;
  return at.getTime() - changedMs <= ZD_FULFILLMENT_DEADLINE_CHANGE_VISIBLE_MS;
}

export function resolveZdFulfillmentDeadlineChangeDisplay(
  order: ZdFulfillmentChangeOrder,
  at: Date = new Date()
): ZdFulfillmentDeadlineChangeDisplay | null {
  if (!isZdFulfillmentDeadlineChangeVisible(order, at)) return null;
  return buildZdFulfillmentDeadlineChangeDisplay(
    order.zd_fulfillment_previous_deadline!.trim(),
    order.zd_fulfillment_deadline!.trim(),
    order.zd_fulfillment_deadline_changed_at!.trim()
  );
}

/** Pola zmiany terminu przy zapisie sync ZD. */
export function buildZdFulfillmentDeadlineChangePersistFields(
  order: ZdFulfillmentChangeOrder,
  nextDeadline: string | null,
  nowIso: string
): {
  zd_fulfillment_previous_deadline: string | null;
  zd_fulfillment_deadline_changed_at: string | null;
  zd_fulfillment_deadline_change_seen_at: string | null;
} {
  if (!nextDeadline?.trim()) {
    return {
      zd_fulfillment_previous_deadline: null,
      zd_fulfillment_deadline_changed_at: null,
      zd_fulfillment_deadline_change_seen_at: null,
    };
  }

  const current = order.zd_fulfillment_deadline?.trim();
  const next = nextDeadline.trim();
  if (!current || current === next) {
    return {
      zd_fulfillment_previous_deadline: order.zd_fulfillment_previous_deadline ?? null,
      zd_fulfillment_deadline_changed_at: order.zd_fulfillment_deadline_changed_at ?? null,
      zd_fulfillment_deadline_change_seen_at:
        order.zd_fulfillment_deadline_change_seen_at ?? null,
    };
  }

  return {
    zd_fulfillment_previous_deadline: current,
    zd_fulfillment_deadline_changed_at: nowIso,
    zd_fulfillment_deadline_change_seen_at: null,
  };
}

export function pickLatestZdFulfillmentDeadlineChange(
  orders: ZdFulfillmentChangeOrder[],
  at: Date = new Date()
): ZdFulfillmentDeadlineChangeDisplay | null {
  let best: ZdFulfillmentDeadlineChangeDisplay | null = null;

  for (const order of orders) {
    const change = resolveZdFulfillmentDeadlineChangeDisplay(order, at);
    if (!change) continue;
    if (!best || change.changedAt > best.changedAt) {
      best = change;
    }
  }

  return best;
}

export function orderIdsWithVisibleZdFulfillmentDeadlineChange(
  orders: Array<Pick<IndividualOrder, "id"> & ZdFulfillmentChangeOrder>,
  at: Date = new Date()
): string[] {
  return orders
    .filter((order) => isZdFulfillmentDeadlineChangeVisible(order, at))
    .map((order) => order.id);
}
