/**
 * Stan „już zobaczono podsumowanie miesiąca” (klient).
 * Klucz = miesiąc podsumowania (YYYY-MM) — baner i wyróżnienie w menu
 * wracają przy kolejnym cyklu (nowy miniony miesiąc).
 */

import {
  defaultMonthlySummaryMonthKey,
  isMonthlySummaryAvailable,
} from "@/lib/data/monthly-stats-shared";

export const MONTHLY_SUMMARY_SEEN_STORAGE_KEY = "monthly-summary-seen";
/** Stary klucz z sessionStorage (baner z X). */
const LEGACY_DISMISS_KEY = "monthly-summary-dismissed";
export const MONTHLY_SUMMARY_SEEN_EVENT = "monthly-summary-seen";

export const MONTHLY_SUMMARY_HREF = "/podsumowanie-miesieczne";

export function readMonthlySummarySeenMonth(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const fromLocal = localStorage.getItem(MONTHLY_SUMMARY_SEEN_STORAGE_KEY);
    if (fromLocal) return fromLocal;
    const legacy = sessionStorage.getItem(LEGACY_DISMISS_KEY);
    if (legacy) {
      localStorage.setItem(MONTHLY_SUMMARY_SEEN_STORAGE_KEY, legacy);
      sessionStorage.removeItem(LEGACY_DISMISS_KEY);
      return legacy;
    }
    return null;
  } catch {
    return null;
  }
}

export function markMonthlySummarySeen(monthKey?: string): void {
  if (typeof window === "undefined") return;
  const key = monthKey ?? defaultMonthlySummaryMonthKey();
  try {
    localStorage.setItem(MONTHLY_SUMMARY_SEEN_STORAGE_KEY, key);
    sessionStorage.removeItem(LEGACY_DISMISS_KEY);
    window.dispatchEvent(new Event(MONTHLY_SUMMARY_SEEN_EVENT));
  } catch {
    /* ignore */
  }
}

/** Czy w oknie „pierwsze 7 dni” użytkownik jeszcze nie wszedł w podsumowanie. */
export function monthlySummaryNeedsAttention(
  at: Date = new Date(),
  seenMonth: string | null = typeof window !== "undefined" ? readMonthlySummarySeenMonth() : null
): boolean {
  if (!isMonthlySummaryAvailable(at)) return false;
  return seenMonth !== defaultMonthlySummaryMonthKey(at);
}

export function subscribeMonthlySummarySeen(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => onStoreChange();
  window.addEventListener(MONTHLY_SUMMARY_SEEN_EVENT, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(MONTHLY_SUMMARY_SEEN_EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}
