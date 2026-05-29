import type { SalesPaymentWatch } from "@/types/database";

function dateOnlyTimestamp(value: string | null | undefined): number | null {
  if (!value) return null;
  const d = value.slice(0, 10);
  const t = Date.parse(`${d}T12:00:00`);
  return Number.isFinite(t) ? t : null;
}

export function todayStart(referenceMs?: number): number {
  if (referenceMs != null) return referenceMs;
  const now = new Date();
  return Date.parse(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}T00:00:00`
  );
}

/** Follow-up przypada dziś lub wcześniej. */
export function isFollowUpDue(
  followUpAt: string | null | undefined,
  referenceMs?: number
): boolean {
  if (!followUpAt) return false;
  const d = followUpAt.slice(0, 10);
  const ref = referenceMs != null ? new Date(referenceMs) : new Date();
  const todayIso = `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, "0")}-${String(ref.getDate()).padStart(2, "0")}`;
  return d <= todayIso;
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
  const ref = referenceMs != null ? new Date(referenceMs) : new Date();
  return `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, "0")}-${String(ref.getDate()).padStart(2, "0")}`;
}

export function addDaysToIso(isoDate: string, days: number): string {
  const d = new Date(`${isoDate.slice(0, 10)}T12:00:00`);
  d.setDate(d.getDate() + days);
  return todayIso(d.getTime());
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
  options?: { preview?: boolean }
): string {
  const primary = clientLabel.split(/[·(,]/)[0]?.trim() || clientLabel.trim();
  const params = new URLSearchParams();
  if (options?.preview) params.set("dla", salesPersonId);
  if (primary) params.set("klient", primary.slice(0, 60));
  const qs = params.toString();
  return qs ? `/moje?${qs}` : "/moje";
}

export function watchNeedsNotepadAttention(
  watch: Pick<SalesPaymentWatch, "follow_up_at" | "settled_at" | "archived_at">,
  referenceMs?: number
): boolean {
  if (watch.settled_at || watch.archived_at) return false;
  return isFollowUpDue(watch.follow_up_at, referenceMs);
}
