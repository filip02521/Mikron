import { isFollowUpDue, followUpTimestamp } from "@/lib/sales/notepad-follow-up";
import type { SalesPaymentWatch } from "@/types/database";

function dueTimestamp(watch: SalesPaymentWatch): number | null {
  if (!watch.due_at) return null;
  const d = watch.due_at.slice(0, 10);
  const t = Date.parse(`${d}T12:00:00`);
  return Number.isFinite(t) ? t : null;
}

function todayStart(referenceMs?: number): number {
  if (referenceMs != null) return referenceMs;
  const now = new Date();
  return Date.parse(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}T00:00:00`
  );
}

/** Data terminu wcześniejsza niż dziś. */
export function isDueDateOverdue(
  dueAt: string | null | undefined,
  referenceMs?: number
): boolean {
  const due = dueTimestamp({ due_at: dueAt ?? null } as SalesPaymentWatch);
  if (due == null) return false;
  return due < todayStart(referenceMs);
}

/** ZK z terminem wcześniejszym niż dziś (tylko aktywne). */
export function isPaymentWatchOverdue(
  watch: SalesPaymentWatch,
  referenceMs?: number
): boolean {
  if (watch.settled_at || watch.archived_at) return false;
  const due = dueTimestamp(watch);
  if (due == null) return false;
  return due < todayStart(referenceMs);
}

/** Najpierw po terminie, potem rosnąco po terminie, bez terminu na końcu. */
export function sortPaymentWatches(
  watches: SalesPaymentWatch[],
  referenceMs?: number
): SalesPaymentWatch[] {
  const now = todayStart(referenceMs);
  return [...watches].sort((a, b) => {
    const followUpDueA = isFollowUpDue(a.follow_up_at, referenceMs);
    const followUpDueB = isFollowUpDue(b.follow_up_at, referenceMs);
    if (followUpDueA !== followUpDueB) return followUpDueA ? -1 : 1;

    const followA = followUpTimestamp(a.follow_up_at);
    const followB = followUpTimestamp(b.follow_up_at);
    if (followA != null && followB != null && followA !== followB) return followA - followB;
    if (followA != null && followB == null) return -1;
    if (followA == null && followB != null) return 1;

    const dueA = dueTimestamp(a);
    const dueB = dueTimestamp(b);
    const overdueA = dueA != null && dueA < now;
    const overdueB = dueB != null && dueB < now;
    if (overdueA !== overdueB) return overdueA ? -1 : 1;
    if (dueA != null && dueB != null && dueA !== dueB) return dueA - dueB;
    if (dueA != null && dueB == null) return -1;
    if (dueA == null && dueB != null) return 1;
    return a.created_at.localeCompare(b.created_at);
  });
}
