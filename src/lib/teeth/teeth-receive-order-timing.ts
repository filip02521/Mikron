import { formatPlDate } from "@/lib/display-labels";
import { orderPlacementAt, submittedAt } from "@/lib/orders/order-timing";
import type { IndividualOrder } from "@/types/database";

export type TeethReceiveOrderTimingSource = Pick<
  IndividualOrder,
  "action_at" | "ordered_at" | "teeth_ordered_at" | "status"
>;

export type TeethReceiveOrderTiming = {
  submittedIso: string | null;
  orderedIso: string | null;
  submittedLabel: string | null;
  orderedLabel: string | null;
};

function dateLabel(iso: string | null | undefined): string | null {
  const trimmed = iso?.trim();
  if (!trimmed) return null;
  return formatPlDate(trimmed.slice(0, 10));
}

/** Prośba handlowca + złożenie u dostawcy — do przyjęcia zębów. */
export function resolveTeethReceiveOrderTiming(
  order: TeethReceiveOrderTimingSource
): TeethReceiveOrderTiming {
  const submittedIso = submittedAt(order)?.trim() || null;
  const orderedIso =
    order.teeth_ordered_at?.trim() || orderPlacementAt(order)?.trim() || null;
  return {
    submittedIso,
    orderedIso,
    submittedLabel: dateLabel(submittedIso),
    orderedLabel: dateLabel(orderedIso),
  };
}

/** Jedna linia: „Prośba 12.03.2026 · Zamówiono 18.03.2026”. */
export function formatTeethReceiveOrderTimingLine(
  timing: TeethReceiveOrderTiming
): string | null {
  const parts: string[] = [];
  if (timing.submittedLabel) parts.push(`Prośba ${timing.submittedLabel}`);
  if (timing.orderedLabel) parts.push(`Zamówiono ${timing.orderedLabel}`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

/**
 * Podsumowanie bloku handlowca (kilka próśb).
 * Gdy daty się różnią — „od …” po najstarszej w bloku.
 */
export function formatTeethReceiveBlockTimingLine(
  orders: readonly TeethReceiveOrderTimingSource[]
): string | null {
  if (orders.length === 0) return null;

  const timings = orders.map(resolveTeethReceiveOrderTiming);
  const submittedLabels = [
    ...new Set(timings.map((t) => t.submittedLabel).filter(Boolean)),
  ] as string[];
  const orderedLabels = [
    ...new Set(timings.map((t) => t.orderedLabel).filter(Boolean)),
  ] as string[];

  if (submittedLabels.length <= 1 && orderedLabels.length <= 1) {
    return formatTeethReceiveOrderTimingLine({
      submittedIso: timings[0]?.submittedIso ?? null,
      orderedIso: timings[0]?.orderedIso ?? null,
      submittedLabel: submittedLabels[0] ?? null,
      orderedLabel: orderedLabels[0] ?? null,
    });
  }

  const oldestSubmitted = timings
    .map((t) => t.submittedIso)
    .filter((iso): iso is string => Boolean(iso))
    .sort()[0];
  const oldestOrdered = timings
    .map((t) => t.orderedIso)
    .filter((iso): iso is string => Boolean(iso))
    .sort()[0];

  const parts: string[] = [];
  if (oldestSubmitted) {
    parts.push(
      submittedLabels.length > 1
        ? `Prośba od ${dateLabel(oldestSubmitted)}`
        : `Prośba ${dateLabel(oldestSubmitted)}`
    );
  }
  if (oldestOrdered) {
    parts.push(
      orderedLabels.length > 1
        ? `Zamówiono od ${dateLabel(oldestOrdered)}`
        : `Zamówiono ${dateLabel(oldestOrdered)}`
    );
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

/** Czy w bloku handlowca daty prośby / zamówienia się rozjeżdżają. */
export function teethReceiveBlockHasMixedTiming(
  orders: readonly TeethReceiveOrderTimingSource[]
): boolean {
  if (orders.length <= 1) return false;
  const timings = orders.map(resolveTeethReceiveOrderTiming);
  const submitted = new Set(
    timings.map((t) => t.submittedLabel).filter(Boolean)
  );
  const ordered = new Set(timings.map((t) => t.orderedLabel).filter(Boolean));
  return submitted.size > 1 || ordered.size > 1;
}

/**
 * Daty do belki handlowca — przy mieszanych dniach najstarsza + flaga „od”.
 */
export function resolveTeethReceiveBlockTimingDisplay(
  orders: readonly TeethReceiveOrderTimingSource[]
): {
  submittedLabel: string | null;
  orderedLabel: string | null;
  submittedFrom: boolean;
  orderedFrom: boolean;
} | null {
  if (orders.length === 0) return null;
  const timings = orders.map(resolveTeethReceiveOrderTiming);
  const submittedLabels = [
    ...new Set(timings.map((t) => t.submittedLabel).filter(Boolean)),
  ] as string[];
  const orderedLabels = [
    ...new Set(timings.map((t) => t.orderedLabel).filter(Boolean)),
  ] as string[];
  if (submittedLabels.length === 0 && orderedLabels.length === 0) return null;

  const oldestSubmitted = timings
    .map((t) => t.submittedIso)
    .filter((iso): iso is string => Boolean(iso))
    .sort()[0];
  const oldestOrdered = timings
    .map((t) => t.orderedIso)
    .filter((iso): iso is string => Boolean(iso))
    .sort()[0];

  return {
    submittedLabel: dateLabel(oldestSubmitted) ?? submittedLabels[0] ?? null,
    orderedLabel: dateLabel(oldestOrdered) ?? orderedLabels[0] ?? null,
    submittedFrom: submittedLabels.length > 1,
    orderedFrom: orderedLabels.length > 1,
  };
}
