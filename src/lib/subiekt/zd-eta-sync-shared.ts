/** Stan sesji i helpery ETA ZD na /moje — bezpieczne dla klienta (bez I/O Subiekta). */

import { canEstimateDeliveryEta, orderPlacementAt } from "@/lib/orders/order-timing";
import type { IndividualOrder } from "@/types/database";

import { clientFetchTimeoutMs } from "@/lib/timing";

/**
 * Soft-budget auto-sync na /moje (musi być < force < client < route maxDuration).
 * Trzymane tu (shared), żeby klient mógł wyliczyć swój abort bez importu serwera.
 */
export const ZD_ETA_MOJE_MAX_DURATION_MS = 45_000;
/** Soft-budget ręcznego odświeżenia ZD na /moje. */
export const ZD_ETA_MOJE_FORCE_MAX_DURATION_MS = 50_000;
/** Route `/api/sales/zd-eta-refresh` — twardy limit platformy (sekundy). Zapas nad klientem. */
export const ZD_ETA_MOJE_ROUTE_MAX_DURATION_SEC = 75;
/** Cron ZD ETA — soft budget wewnątrz maxDuration=300s. */
export const ZD_ETA_CRON_BUDGET_MS = 280_000;

/** Limit czasu żądania z /moje — powyżej budżetu force + zapas TTFB/JSON. */
export const ZD_ETA_MOJE_CLIENT_FETCH_TIMEOUT_MS = clientFetchTimeoutMs(
  ZD_ETA_MOJE_FORCE_MAX_DURATION_MS,
  15_000
);
/** Po tylu ms w tle na /moje — ponowny sync terminów ZD po powrocie do karty. */
export const ZD_ETA_MOJE_VISIBILITY_RESYNC_MS = 30 * 60 * 1000;

export type MojeZdEtaRefreshResult = {
  candidates: number;
  processed: number;
  updated: number;
  cleared: number;
  skipped?: boolean;
  reason?: string;
  subiektOffline?: boolean;
  timedOut?: boolean;
};

/** Stan sesji auto-sync na /moje (sessionStorage). */
export type MojeZdEtaSessionState = {
  /** Liczba pozycji wymagających sync przy ostatnim przebiegu (SSR). */
  eligibleAtRun: number;
  candidates: number;
  processed: number;
  at: number;
};

/** Czy pominąć auto-sync w tej wizycie (po udanym przebiegu bez pozostałej pracy). */
export function shouldSkipMojeZdEtaSessionSync(
  syncEligibleCount: number,
  state: MojeZdEtaSessionState | null,
  nowMs = Date.now()
): boolean {
  if (syncEligibleCount <= 0) return true;
  if (!state) return false;
  if (nowMs - state.at >= ZD_ETA_MOJE_VISIBILITY_RESYNC_MS) return false;
  if (state.processed < state.candidates) return false;
  if (syncEligibleCount > state.eligibleAtRun) return false;
  if (syncEligibleCount < state.eligibleAtRun) return false;
  return true;
}

export function buildMojeZdEtaSessionState(
  syncEligibleCount: number,
  body: MojeZdEtaRefreshResult,
  nowMs = Date.now()
): MojeZdEtaSessionState {
  return {
    eligibleAtRun: syncEligibleCount,
    candidates: body.candidates ?? 0,
    processed: body.processed ?? 0,
    at: nowMs,
  };
}

/** Kiedy sesja przeglądarki może uznać auto-sync za zakończony (bez ponawiania). */
export function shouldMarkMojeZdEtaSessionDone(
  body: MojeZdEtaRefreshResult,
  clientEligibleCount = 0
): boolean {
  if (body.skipped && body.reason === "lock_held") return false;
  if (body.timedOut) {
    const candidates = body.candidates ?? 0;
    const processed = body.processed ?? 0;
    return candidates <= 0 || processed >= candidates;
  }
  if (body.subiektOffline) {
    const candidates = body.candidates ?? 0;
    const processed = body.processed ?? 0;
    if (candidates > 0 && processed < candidates) return false;
    if (
      body.skipped &&
      body.reason === "subiekt_offline" &&
      candidates === 0 &&
      clientEligibleCount > 0
    ) {
      return false;
    }
    return true;
  }
  if (body.skipped) return true;
  const candidates = body.candidates ?? 0;
  const processed = body.processed ?? 0;
  if (candidates <= 0) return true;
  return processed >= candidates;
}

/** Czy warto ponowić auto-sync w tej samej wizycie (timeout, offline częściowy, błąd sieci). */
export function shouldRetryMojeZdEtaSync(
  body: MojeZdEtaRefreshResult | null,
  networkRetry: number,
  maxRetries: number
): boolean {
  if (networkRetry >= maxRetries) return false;
  if (!body) return true;
  if (body.skipped && body.reason === "lock_held") return false;
  if (body.timedOut) {
    const candidates = body.candidates ?? 0;
    const processed = body.processed ?? 0;
    return candidates > processed;
  }
  if (body.subiektOffline) {
    const candidates = body.candidates ?? 0;
    const processed = body.processed ?? 0;
    return candidates > processed;
  }
  const candidates = body.candidates ?? 0;
  const processed = body.processed ?? 0;
  if (!body.skipped && candidates > processed) return true;
  return false;
}

/** Czy po auto-sync warto odświeżyć RSC /moje (tylko gdy dane się zmieniły). */
export function shouldRefreshMojeZdEtaPage(body: MojeZdEtaRefreshResult | null): boolean {
  if (!body) return false;
  if ((body.updated ?? 0) > 0 || (body.cleared ?? 0) > 0) return true;
  return false;
}

/** Pozycja zamówienia kwalifikująca się do synchronizacji terminu ZD (bez TTL). */
export function isZdEtaSyncEligible(order: IndividualOrder): boolean {
  if (order.request_kind === "informacja") {
    if (
      order.status === "Zrealizowane" ||
      order.status === "Anulowane" ||
      order.status === "Weryfikacja"
    ) {
      return false;
    }
    if (!order.supplier_id) return false;
    if (!order.ordered_at?.trim()) return false;
    const hasTwId = order.subiekt_tw_id != null && order.subiekt_tw_id > 0;
    const hasSymbol = order.symbol && order.symbol.trim() && order.symbol.trim() !== "-";
    const hasMikran = order.mikran_code && order.mikran_code.trim();
    if (!hasTwId && !hasSymbol && !hasMikran) return false;
    return true;
  }
  if (order.status !== "Zamowione" && order.status !== "Czesciowo_zrealizowane") {
    return false;
  }
  if (!order.supplier_id || !canEstimateDeliveryEta(order)) return false;
  return Boolean(orderPlacementAt(order));
}
