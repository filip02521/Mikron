import { formatPlDate } from "@/lib/display-labels";
import { parseDateOnly } from "@/lib/orders/dates";
import { orderPlacementAt } from "@/lib/orders/order-timing";
import { deadlineMatchesPlacementDay } from "@/lib/orders/zd-fulfillment-placeholder-deadline";
import type { IndividualOrder } from "@/types/database";

/** Informacja o zmianie widoczna przez 7 dni lub do potwierdzenia. */
export const ZD_FULFILLMENT_DEADLINE_CHANGE_VISIBLE_MS = 7 * 24 * 60 * 60 * 1000;

/** Nagłówek sekcji — kolejna zmiana terminu (nie pierwsze ustalenie). */
export const ZD_FULFILLMENT_DEADLINE_CHANGE_CAPTION = "Zmiana terminu";

/** Nagłówek sekcji — pierwszy docelowy termin po placeholderze z dnia zamówienia. */
export const ZD_FULFILLMENT_FIRST_DEADLINE_CAPTION = "Termin z dokumentu ZD";

export type ZdFulfillmentDeadlineChangeVariant =
  | "postponed"
  | "moved_earlier"
  | "first_confirmed";

export type ZdFulfillmentDeadlineChangeDisplay = {
  previousDeadline: string;
  currentDeadline: string;
  changedAt: string;
  variant: ZdFulfillmentDeadlineChangeVariant;
  title: string;
  detail: string;
};

type ZdFulfillmentChangePersistOrder = Pick<
  IndividualOrder,
  | "zd_fulfillment_deadline"
  | "zd_fulfillment_previous_deadline"
  | "zd_fulfillment_deadline_changed_at"
  | "zd_fulfillment_deadline_change_seen_at"
>;

type ZdFulfillmentChangeOrder = ZdFulfillmentChangePersistOrder &
  Pick<IndividualOrder, "ordered_at" | "action_at" | "status">;

export function isFirstZdFulfillmentDeadlineConfirmation(
  order: Pick<IndividualOrder, "ordered_at" | "action_at" | "status">,
  previousDeadline: string
): boolean {
  return deadlineMatchesPlacementDay(previousDeadline, orderPlacementAt(order));
}

export function zdFulfillmentDeadlineChangeVariant(
  previousDeadline: string,
  currentDeadline: string
): Exclude<ZdFulfillmentDeadlineChangeVariant, "first_confirmed"> {
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
  changedAt: string,
  options?: { firstConfirmation?: boolean }
): ZdFulfillmentDeadlineChangeDisplay {
  if (options?.firstConfirmation) {
    const currentLabel = formatPlDate(currentDeadline);
    return {
      previousDeadline,
      currentDeadline,
      changedAt,
      variant: "first_confirmed",
      title: "Ustalono termin realizacji",
      detail: `Docelowo ${currentLabel}`,
    };
  }

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

  const previous = order.zd_fulfillment_previous_deadline!.trim();
  const firstConfirmation = isFirstZdFulfillmentDeadlineConfirmation(order, previous);

  return buildZdFulfillmentDeadlineChangeDisplay(
    previous,
    order.zd_fulfillment_deadline!.trim(),
    order.zd_fulfillment_deadline_changed_at!.trim(),
    { firstConfirmation }
  );
}

/** Pola zmiany terminu przy zapisie sync ZD. */
export function buildZdFulfillmentDeadlineChangePersistFields(
  order: ZdFulfillmentChangePersistOrder,
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

export function zdFulfillmentDeadlineChangeShortLabel(
  change: ZdFulfillmentDeadlineChangeDisplay
): string {
  const currentLabel = formatPlDate(change.currentDeadline);
  if (change.variant === "first_confirmed") {
    return `${change.title} · ${currentLabel}`;
  }
  const previousLabel = formatPlDate(change.previousDeadline);
  return `${change.title} · ${previousLabel} → ${currentLabel}`;
}

export function orderIdsWithVisibleZdFulfillmentDeadlineChange(
  orders: Array<Pick<IndividualOrder, "id"> & ZdFulfillmentChangeOrder>,
  at: Date = new Date()
): string[] {
  return orders
    .filter((order) => isZdFulfillmentDeadlineChangeVisible(order, at))
    .map((order) => order.id);
}
