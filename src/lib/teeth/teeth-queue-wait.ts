import { formatPlDate } from "@/lib/display-labels";
import { warsawDateKeyFromIso } from "@/lib/time/warsaw";
import type { IndividualOrder } from "@/types/database";

export type TeethQueueEnteredSource = Partial<
  Pick<IndividualOrder, "teeth_queue_entered_at" | "created_at" | "action_at">
>;

/** Data wejścia do kolejki działu zębów (najpewniejsze pole + fallbacki). */
export function resolveTeethQueueEnteredAt(
  item: TeethQueueEnteredSource,
): string | null {
  const entered = item.teeth_queue_entered_at?.trim();
  if (entered) return entered;
  const created = item.created_at?.trim();
  if (created) return created;
  const action = item.action_at?.trim();
  return action || null;
}

/** Liczba dni kalendarzowych (Warszawa) od wejścia do kolejki. */
export function teethQueueWaitCalendarDays(
  enteredAtIso: string,
  now: Date = new Date(),
): number {
  const startKey = warsawDateKeyFromIso(enteredAtIso);
  const endKey = warsawDateKeyFromIso(now.toISOString());
  if (!startKey || !endKey) return 0;
  const start = Date.parse(`${startKey}T12:00:00`);
  const end = Date.parse(`${endKey}T12:00:00`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.max(0, Math.round((end - start) / 86_400_000));
}

export function formatTeethQueueWaitDays(days: number): string {
  if (days <= 0) return "dziś";
  if (days === 1) return "1 dzień";
  if (days >= 2 && days <= 4) return `${days} dni`;
  return `${days} dni`;
}

/** Etykieta UI: „od 12.03 · 4 dni”. */
export function formatTeethQueueWaitLabel(
  item: TeethQueueEnteredSource,
  now: Date = new Date(),
): string | null {
  const enteredAt = resolveTeethQueueEnteredAt(item);
  if (!enteredAt) return null;
  const days = teethQueueWaitCalendarDays(enteredAt, now);
  return `od ${formatPlDate(enteredAt.slice(0, 10))} · ${formatTeethQueueWaitDays(days)}`;
}

/** Najstarsze wejście w grupie (do nagłówka handlowca). */
export function oldestTeethQueueEnteredAt(
  items: TeethQueueEnteredSource[],
): string | null {
  let oldest: string | null = null;
  for (const item of items) {
    const at = resolveTeethQueueEnteredAt(item);
    if (!at) continue;
    if (!oldest || at < oldest) oldest = at;
  }
  return oldest;
}
