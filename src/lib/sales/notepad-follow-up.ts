import type { SalesZkWatch } from "@/types/database";
import { formatDateString } from "@/lib/orders/dates";
import { todayInWarsaw } from "@/lib/time/warsaw";

function dateOnlyTimestamp(value: string | null | undefined): number | null {
  if (!value) return null;
  const d = value.slice(0, 10);
  const t = Date.parse(`${d}T12:00:00`);
  return Number.isFinite(t) ? t : null;
}

export function todayStart(referenceMs?: number): number {
  const iso = todayIso(referenceMs);
  return Date.parse(`${iso}T00:00:00`);
}

/** Follow-up przypada dziś lub wcześniej (kalendarz Warszawa). */
export function isFollowUpDue(
  followUpAt: string | null | undefined,
  referenceMs?: number
): boolean {
  if (!followUpAt) return false;
  const d = followUpAt.slice(0, 10);
  return d <= todayIso(referenceMs);
}

export function followUpTimestamp(
  followUpAt: string | null | undefined
): number | null {
  return dateOnlyTimestamp(followUpAt);
}

export function formatFollowUpLabel(followUpAt: string | null | undefined): string | null {
  const d = followUpAt?.slice(0, 10);
  if (!d) return null;
  const [y, m, day] = d.split("-");
  if (!y || !m || !day) return d;
  return `${day}.${m}.${y}`;
}

export function todayIso(referenceMs?: number): string {
  const ref = referenceMs != null ? new Date(referenceMs) : todayInWarsaw();
  return formatDateString(ref);
}

export function addDaysToIso(isoDate: string, days: number): string {
  const d = new Date(`${isoDate.slice(0, 10)}T12:00:00`);
  d.setDate(d.getDate() + days);
  return formatDateString(d);
}

export function followUpQuickDates(): { label: string; value: string }[] {
  const today = todayIso();
  return [
    { label: "Dziś", value: today },
    { label: "Jutro", value: addDaysToIso(today, 1) },
    { label: "Za tydz.", value: addDaysToIso(today, 7) },
  ];
}

/** Link do panelu zamówień z filtrem klienta. */
export function buildMojeClientLink(
  salesPersonId: string,
  clientLabel: string,
  options?: {
    preview?: boolean;
    clientKhId?: number | null;
    zkWatchId?: string | null;
    zkNumber?: string | null;
  }
): string {
  const primary = clientLabel.split(/[·(,]/)[0]?.trim() || clientLabel.trim();
  const params = new URLSearchParams();
  if (options?.preview) params.set("dla", salesPersonId);
  if (options?.zkWatchId?.trim()) params.set("zkWatch", options.zkWatchId.trim());
  if (options?.zkNumber?.trim()) params.set("zk", options.zkNumber.trim().slice(0, 80));
  if (primary) params.set("klient", primary.slice(0, 60));
  const kh = options?.clientKhId;
  if (kh != null && Number.isFinite(kh) && kh > 0) {
    params.set("kh", String(Math.trunc(kh)));
  }
  const qs = params.toString();
  return qs ? `/moje?${qs}` : "/moje";
}

export function watchNeedsNotepadAttention(
  watch: Pick<SalesZkWatch, "follow_up_at" | "closed_at" | "archived_at">,
  referenceMs?: number
): boolean {
  if (watch.closed_at || watch.archived_at) return false;
  return isFollowUpDue(watch.follow_up_at, referenceMs);
}
