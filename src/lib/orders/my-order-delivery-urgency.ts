import { differenceInCalendarDays, isSameWeek } from "date-fns";
import type { DeliveryDateMetaDisplay } from "@/lib/orders/delivery-date-meta-label";
import type { MyOrderRow } from "@/lib/orders/my-order-presenter";
import { parseDateOnly, toDateOnly } from "@/lib/orders/dates";
import { isMyOrderPartialStockRow } from "@/lib/orders/my-order-sales-ui";
import { resolveZdFulfillmentUrgency } from "@/lib/orders/my-order-zd-fulfillment-display";
import { todayInWarsaw } from "@/lib/time/warsaw";

export type DeliveryUrgency =
  | "overdue"
  | "today"
  | "tomorrow"
  | "this_week"
  | "later"
  | "unknown"
  | "pending";

export type MyOrderDeliveryUrgency = {
  urgency: DeliveryUrgency;
  expectedDate: Date | null;
  /** Krótka etykieta na badge (np. „Jutro”). */
  shortLabel: string | null;
  /** Dłuższy opis pod datą. */
  detailLabel: string | null;
};

const DD_MM_YYYY = /(\d{2})\.(\d{2})\.(\d{4})/;

/** Data dostawy z ZD lub z timingLabel (szacunek). */
export function resolveMyOrderExpectedDeliveryDate(row: MyOrderRow): Date | null {
  if (row.zdFulfillment?.deadline?.trim()) {
    return parseDateOnly(row.zdFulfillment.deadline.trim());
  }
  const raw = row.timingLabel?.trim();
  if (!raw) return null;
  if (/^E-mail\s/i.test(raw)) return null;
  const match = raw.match(DD_MM_YYYY);
  if (!match) return null;
  const [, dd, mm, yyyy] = match;
  return parseDateOnly(`${yyyy}-${mm}-${dd}`);
}

export function classifyDeliveryUrgency(
  expectedDate: Date | null,
  options?: {
    at?: Date;
    pending?: boolean;
  }
): MyOrderDeliveryUrgency {
  if (options?.pending) {
    return {
      urgency: "pending",
      expectedDate: null,
      shortLabel: null,
      detailLabel: null,
    };
  }
  if (!expectedDate) {
    return {
      urgency: "unknown",
      expectedDate: null,
      shortLabel: null,
      detailLabel: null,
    };
  }

  const today = toDateOnly(options?.at ?? todayInWarsaw());
  const target = toDateOnly(expectedDate);
  const diff = differenceInCalendarDays(target, today);

  if (diff < 0) {
    const days = Math.abs(diff);
    return {
      urgency: "overdue",
      expectedDate: target,
      shortLabel: "Po terminie",
      detailLabel:
        days === 0 ? "Termin minął dziś" : `Opóźnienie ${days} dni`,
    };
  }
  if (diff === 0) {
    return {
      urgency: "today",
      expectedDate: target,
      shortLabel: "Dziś",
      detailLabel: "Planowana dostawa dziś",
    };
  }
  if (diff === 1) {
    return {
      urgency: "tomorrow",
      expectedDate: target,
      shortLabel: "Jutro",
      detailLabel: "Planowana dostawa jutro",
    };
  }
  if (isSameWeek(target, today, { weekStartsOn: 1 })) {
    return {
      urgency: "this_week",
      expectedDate: target,
      shortLabel: "Ten tydzień",
      detailLabel: `Za ${diff} dni — w tym tygodniu`,
    };
  }
  return {
    urgency: "later",
    expectedDate: target,
    shortLabel: null,
    detailLabel: `Za ${diff} dni`,
  };
}

/** Badge pilności tylko gdy termin wymaga uwagi (nie dla jutro / ten tydzień). */
export function deliveryUrgencyShowsBadge(urgency: DeliveryUrgency): boolean {
  return urgency === "overdue" || urgency === "today";
}

export function deliveryUrgencyBadgeLabel(
  meta: Pick<MyOrderDeliveryUrgency, "urgency" | "shortLabel">
): string | null {
  if (!deliveryUrgencyShowsBadge(meta.urgency)) return null;
  return meta.shortLabel;
}

/**
 * Badge pilności obok DeliveryDateMetaValue — ukryj, gdy primary już mówi to samo
 * (np. badge „Dziś” + primary „Dziś” na zwiniętej karcie ZD).
 */
export function shouldShowDeliveryUrgencyBadgeBesideDateMeta(
  display: Pick<DeliveryDateMetaDisplay, "primaryLabel"> | null | undefined,
  urgency: Pick<MyOrderDeliveryUrgency, "urgency" | "shortLabel">
): boolean {
  const badgeLabel = deliveryUrgencyBadgeLabel(urgency);
  if (!badgeLabel) return false;
  if (display?.primaryLabel === badgeLabel) return false;
  return true;
}

export function resolveMyOrderDeliveryUrgency(
  row: MyOrderRow,
  at: Date = todayInWarsaw()
): MyOrderDeliveryUrgency {
  if (row.zdEtaPending) {
    return classifyDeliveryUrgency(null, { at, pending: true });
  }
  if (row.zdFulfillment) {
    return resolveZdFulfillmentUrgency(row.zdFulfillment, at);
  }
  return classifyDeliveryUrgency(resolveMyOrderExpectedDeliveryDate(row), { at });
}

/**
 * Sekcja „Czekamy na dostawę”: od najbliższego terminu u góry
 * (pilne dostawy widoczne od razu po wejściu w sekcję).
 */
export function sortOrderedProgressByDelivery(
  rows: MyOrderRow[],
  at: Date = todayInWarsaw()
): MyOrderRow[] {
  const sortKey = (row: MyOrderRow): number => {
    const urgency = resolveMyOrderDeliveryUrgency(row, at);
    if (urgency.expectedDate) return urgency.expectedDate.getTime();
    if (urgency.urgency === "pending") return Number.POSITIVE_INFINITY - 1;
    return Number.POSITIVE_INFINITY;
  };

  return [...rows].sort((a, b) => {
    const ka = sortKey(a);
    const kb = sortKey(b);
    if (ka !== kb) return ka - kb;
    return b.submittedLabel.localeCompare(a.submittedLabel, "pl");
  });
}

/** Lewy akcent wiersza — częściowa dostawa z towarem na magazynie. */
export function resolveMyOrderPartialStockRowVisual(
  row: MyOrderRow
): { borderAccent: string; collapsedBg: string } | null {
  if (!isMyOrderPartialStockRow(row)) return null;
  return {
    borderAccent: "border-l-sky-500",
    collapsedBg: "bg-sky-50/35",
  };
}

/** Lewy akcent wiersza — tylko po terminie (ew. delikatnie dziś). */
export function deliveryUrgencyRowVisual(
  urgency: DeliveryUrgency
): { borderAccent: string; collapsedBg: string | null } | null {
  switch (urgency) {
    case "overdue":
      return {
        borderAccent: "border-l-amber-500",
        collapsedBg: "bg-amber-50/35",
      };
    case "today":
      return {
        borderAccent: "border-l-indigo-300",
        collapsedBg: null,
      };
    default:
      return null;
  }
}

export function resolveMyOrderDeliveryRowVisual(
  row: MyOrderRow,
  at: Date = todayInWarsaw()
): { borderAccent: string; collapsedBg: string | null } | null {
  const partialVisual = resolveMyOrderPartialStockRowVisual(row);
  if (partialVisual) return partialVisual;

  if (row.statusTitle !== "Zamówione" && row.statusTitle !== "Częściowo_zrealizowane") {
    return null;
  }
  const { urgency } = resolveMyOrderDeliveryUrgency(row, at);
  return deliveryUrgencyRowVisual(urgency);
}
