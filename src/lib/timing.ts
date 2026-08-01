/**
 * Wspólne polityki czasu: abort HTTP, budżety jobów, TTL locków, UI safety.
 * Cel: jedna definicja relacji „budżet serwera ≤ maxDuration trasy < timeout klienta”
 * oraz „TTL locka ≥ budżet + zapas”.
 */

/** Uchwyty AbortController z limitem czasu (zamiast rozproszonych setTimeout+abort). */
export type TimeoutAbortHandle = {
  signal: AbortSignal;
  clear: () => void;
};

export function createTimeoutAbort(timeoutMs: number): TimeoutAbortHandle {
  const ms = Math.max(1, Math.floor(timeoutMs));
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  return {
    signal: controller.signal,
    clear: () => clearTimeout(id),
  };
}

export async function withTimeoutAbort<T>(
  timeoutMs: number,
  run: (signal: AbortSignal) => Promise<T>
): Promise<T> {
  const handle = createTimeoutAbort(timeoutMs);
  try {
    return await run(handle.signal);
  } finally {
    handle.clear();
  }
}

/**
 * TTL locka joba (sekundy): budżet pracy + zapas,
 * żeby lock nie wygasł przed kooperatywnym soft-stopem.
 */
export function lockTtlSecondsForBudgetMs(
  budgetMs: number,
  headroomSec = 60
): number {
  const budgetSec = Math.max(1, Math.ceil(Math.max(0, budgetMs) / 1000));
  return budgetSec + Math.max(0, headroomSec);
}

/**
 * Timeout fetcha klienta: budżet/serwerowy soft-limit + zapas na TTFB i JSON.
 * Musi być ≥ budżetu serwera; zwykle też ≥ (route maxDuration * 1000) tylko gdy
 * klient ma czekać do twardego limitu platformy — zwykle wystarczy budżet + headroom.
 */
export function clientFetchTimeoutMs(
  serverBudgetMs: number,
  headroomMs = 10_000
): number {
  const budget = Math.max(0, serverBudgetMs);
  return budget + Math.max(0, headroomMs);
}

export function isTimeBudgetExceeded(
  startedMs: number,
  maxDurationMs: number,
  nowMs: number = Date.now()
): boolean {
  return nowMs - startedMs >= maxDurationMs;
}

/** Domyślny TTL locka gdy job nie deklaruje budżetu. */
export const DEFAULT_JOB_LOCK_TTL_SEC = 30;

/** Purge retencji danych — jeden przebieg może trwać długo. */
export const DATA_RETENTION_LOCK_TTL_SEC = 24 * 60 * 60;

/** Overlay „Przetwarzanie…” — krótki (formularze). */
export const ACTION_PENDING_SAFETY_MS = 30_000;

/** Overlay formularzy z cięższymi akcjami (duże ZK / weryfikacja). */
export const ACTION_PENDING_SAFETY_FORM_MS = 60_000;

/** Overlay dla długich synców admin / katalog (nie chować po 30 s). */
export const ACTION_PENDING_SAFETY_LONG_MS = 120_000;

export const TOAST_DURATION_DEFAULT_MS = 4_500;
export const TOAST_DURATION_WITH_ACTION_MS = 12_000;
