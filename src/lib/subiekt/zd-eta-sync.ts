import { createAdminClient } from "@/lib/supabase/admin";
import { fetchDeliveryStats } from "@/lib/data/queries";
import { normalizeIndividualOrders } from "@/lib/data/normalize-order";
import {
  estimateDeliveryEta,
  isPastExpectedDate,
} from "@/lib/orders/delivery-eta";
import { getDeliveryProgress } from "@/lib/orders/individual";
import { parseDateOnly } from "@/lib/orders/dates";
import { canEstimateDeliveryEta, orderPlacementAt } from "@/lib/orders/order-timing";
import { collectKhIdsForSupplierRef } from "@/lib/data/supplier-subiekt-kh";
import { getAppSupplierRefsCached } from "@/lib/data/supplier-refs";
import { zdSearchPlansForOrderWithKhIds, prioritizeZdLiveSearchPlans } from "@/lib/subiekt/zd-search-for-product";
import {
  getSubiektZdDocumentCached,
  searchSubiektZdCachedForEta,
} from "@/lib/subiekt/subiekt-runtime-cache";
import { partitionZdListItemsForEtaLoad } from "@/lib/subiekt/zd-fulfillment-date";
import {
  SubiektNetworkError,
  SubiektNotConfiguredError,
  SubiektRequestError,
  SubiektTimeoutError,
} from "@/lib/subiekt/errors";
import { findBestMatchingZdDocument, isConfidentZdMatchForOrder, orderHasPartialDeliveryRemaining, orderMatchesZdDocument, orderRemainingQuantity, persistedZdFulfillsOrderRemaining } from "@/lib/subiekt/match-order-to-zd";
import { extractDocKhIds, zdListItemMatchesSupplierKhIds } from "@/lib/subiekt/zd-document-kh";
import { zdDocumentContainsTowId } from "@/lib/subiekt/zd-document-tow-id";
import {
  isActiveZdFulfillmentDeadline,
  parseZdFulfillmentDeadline,
} from "@/lib/subiekt/zd-fulfillment-date";
import { buildZdFulfillmentDeadlineChangePersistFields } from "@/lib/orders/zd-fulfillment-deadline-change";
import { browseZdDocumentsForKhIds } from "@/lib/subiekt/zd-eta-browse";
import {
  filterZdIndexRowsForPlacement,
  loadZdIndexRowsForSupplierSync,
  searchZdFromIndexForOrder,
} from "@/lib/subiekt/zd-eta-index-search";
import {
  earliestZdContractorExtendedDataOd,
  earliestZdContractorInitialDataOd,
  placementIsOlderThanRollingWindow,
  sortMonthChunksNearPlacement,
  zdContractorExtendedDataOdForPlacement,
  zdPlacementBrowseMonthChunks,
  zdSearchPlacementAt,
  zdTwIdBrowseMonthChunks,
  zdTwIdListDataOd,
} from "@/lib/subiekt/zd-search-scope";
import { isSubiektReachable } from "@/lib/subiekt/availability";
import { tryAcquireLock, releaseLock } from "@/lib/services/locks";
import type { IndividualOrder, StatsMode } from "@/types/database";
import type { SubiektDocument } from "@/lib/subiekt/types";

export const ZD_ETA_SYNC_LOCK_KEY = "job_zd_eta_sync";

/** Klucz blokady — per handlowiec na /moje, globalnie dla crona/backupu. */
export function zdEtaSyncLockKey(salesPersonId?: string): string {
  return salesPersonId
    ? `${ZD_ETA_SYNC_LOCK_KEY}:sp:${salesPersonId}`
    : ZD_ETA_SYNC_LOCK_KEY;
}

export type ZdFulfillmentMissContext = {
  subiektOffline?: boolean;
  /** Timeout lub limit dokumentów — wynik „brak ZD” może być niepełny. */
  searchIncomplete?: boolean;
  /** Zapisany dok_id wskazuje na ZD już zrealizowane / nieaktywne w Subiekcie. */
  knownZdInactive?: boolean;
};

export type MojeZdEtaRefreshResult = Pick<
  ZdEtaSyncResult,
  | "candidates"
  | "processed"
  | "updated"
  | "cleared"
  | "skipped"
  | "reason"
  | "subiektOffline"
  | "timedOut"
>;

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

export const ZD_ETA_SYNC_TTL_MS = 6 * 60 * 60 * 1000;
/** Krótszy TTL gdy ZD jest już znany (zd_fulfillment_dok_id) — szybsze wykrycie zmiany terminu przez zakupy. */
export const ZD_ETA_SYNC_KNOWN_ZD_TTL_MS = 2 * 60 * 60 * 1000;
/** Krótszy TTL gdy ostatnio nie znaleziono dopasowanego ZD — szybsza ponowna próba. */
export const ZD_ETA_SYNC_MISS_TTL_MS = 2 * 60 * 60 * 1000;

/** Limity globalne (backup po catalog-zd-sync / ręczne force). */
export const ZD_ETA_MAX_DOCS_PER_RUN = 48;
export const ZD_ETA_MAX_DOCS_PER_SUPPLIER = 24;
export const ZD_ETA_INDEX_LIMIT_PER_SUPPLIER = 40;
/** Indeks ZD (tylko dok_id) — rozszerzone okno 3 miesiące na dostawcę. */
export const ZD_ETA_INDEX_LIMIT_EXTENDED = 120;
export const ZD_ETA_MAX_LIVE_SEARCH_PLANS = 4;
export const ZD_ETA_LIVE_SEARCH_MAX_PAGES = 2;
/** Stronicowanie listy ZD po tw_Id (fałszywe trafienia API — trzeba przeskanować więcej stron). */
export const ZD_ETA_TW_ID_LIVE_SEARCH_MAX_PAGES = 40;
/** Miesięczny browse u dostawcy przed paginacją id=tw_Id (szybszy niż 40 stron fałszywych trafień). */
export const ZD_ETA_TW_ID_BROWSE_MAX_PAGES_PER_CHUNK = 4;
/** Po wykryciu nieaktywnego zapisanego ZD — szersze przeszukanie po tw_Id (np. ZD 31 → ZD 62). */
export const ZD_ETA_REPLACEMENT_SEARCH_MAX_PAGES = 6;
export const ZD_ETA_INITIAL_BROWSE_MAX_PAGES_PER_KH = 2;
export const ZD_ETA_EXTENDED_BROWSE_MAX_PAGES_PER_KH = 8;
export const ZD_ETA_EXTENDED_DOCS_PER_ORDER = 48;
/** Maks. dokumentów wczytanych z góry na dostawcę (reszta budżetu — per pozycja). */
export const ZD_ETA_INITIAL_POOL_MAX_DOCS = 10;

/** Limity przy wejściu handlowca na /moje (after, bez crona). */
export const ZD_ETA_MOJE_MAX_ORDERS = 16;
export const ZD_ETA_MOJE_MAX_DOCS = 96;
export const ZD_ETA_MOJE_MAX_DURATION_MS = 50_000;
/** Limit czasu żądania z /moje — nieco powyżej budżetu serwera. */
export const ZD_ETA_MOJE_CLIENT_FETCH_TIMEOUT_MS = 60_000;
/** Po tylu ms w tle na /moje — ponowny sync terminów ZD po powrocie do karty. */
export const ZD_ETA_MOJE_VISIBILITY_RESYNC_MS = 30 * 60 * 1000;
export const ZD_ETA_MOJE_INDEX_LIMIT_PER_SUPPLIER = 24;
/** Wyższe limity przy ręcznym POST /api/sales/zd-eta-refresh (force). */
export const ZD_ETA_MOJE_FORCE_MAX_ORDERS = 48;
export const ZD_ETA_MOJE_FORCE_MAX_DOCS = 200;
export const ZD_ETA_MOJE_FORCE_MAX_DURATION_MS = 60_000;

/** Globalny backup — stronicowanie zamiast ładowania wszystkich wierszy naraz. */
export const ZD_ETA_GLOBAL_ORDER_SCAN_PAGE = 100;
export const ZD_ETA_GLOBAL_ORDER_SCAN_MAX = 2000;

export type ZdEtaSyncOptions = {
  maxDurationMs?: number;
  force?: boolean;
  /** Tylko prośby jednego handlowca (np. /moje). */
  salesPersonId?: string;
  /** Maks. liczba pozycji w jednym przebiegu. */
  maxOrders?: number;
  maxDocsPerRun?: number;
  maxDocsPerSupplier?: number;
  indexLimitPerSupplier?: number;
  /** Live search w Subiekcie — wyłączony na page load, włączony przy ręcznym odświeżeniu. */
  allowLiveSearch?: boolean;
  /** Pomiń unstable_cache (skrypty CLI / testy). */
  supplierRefs?: SupplierRef[];
};

export type ZdEtaSyncResult = {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  subiektOffline?: boolean;
  candidates: number;
  processed: number;
  updated: number;
  cleared: number;
  docsFetched: number;
  timedOut?: boolean;
};

type SupplierRef = Awaited<ReturnType<typeof getAppSupplierRefsCached>>[number];

function isSubiektOfflineError(error: unknown): boolean {
  return (
    error instanceof SubiektNotConfiguredError ||
    error instanceof SubiektNetworkError ||
    error instanceof SubiektTimeoutError ||
    (error instanceof SubiektRequestError && error.status >= 500)
  );
}

function statsBySupplierId(
  stats: Awaited<ReturnType<typeof fetchDeliveryStats>>
): Record<string, (typeof stats)[number]> {
  const map: Record<string, (typeof stats)[number]> = {};
  for (const row of stats) {
    if (row.supplier_id) map[row.supplier_id] = row;
  }
  return map;
}

/** Pozycja zamówienia kwalifikująca się do synchronizacji terminu ZD (bez TTL). */
export function isZdEtaSyncEligible(order: IndividualOrder): boolean {
  if (order.request_kind === "informacja") return false;
  if (order.status !== "Zamowione" && order.status !== "Czesciowo_zrealizowane") {
    return false;
  }
  if (!order.supplier_id || !canEstimateDeliveryEta(order)) return false;
  return Boolean(orderPlacementAt(order));
}

/** Opóźnione zamówienie — wyższy priorytet sync i stany UI „po terminie”. */
export function isZdEtaOverdueCandidate(
  order: IndividualOrder,
  stats: ReturnType<typeof statsBySupplierId>[string] | undefined,
  statsMode: StatsMode
): boolean {
  if (order.request_kind === "informacja") return false;
  if (order.status !== "Zamowione" && order.status !== "Czesciowo_zrealizowane") {
    return false;
  }
  if (!order.supplier_id || !canEstimateDeliveryEta(order)) return false;

  const placement = orderPlacementAt(order);
  if (!placement) return false;

  if (
    order.zd_fulfillment_source === "zd" &&
    order.zd_fulfillment_deadline?.trim()
  ) {
    const zdDeadline = parseDateOnly(order.zd_fulfillment_deadline.trim());
    if (zdDeadline && isPastExpectedDate(zdDeadline)) return true;
  }

  const eta = estimateDeliveryEta(placement, stats, order.order_type, statsMode);
  if (eta && isPastExpectedDate(eta.expectedDate)) return true;

  if (order.status === "Czesciowo_zrealizowane") {
    const remaining = orderRemainingQuantity(order);
    if (remaining != null && remaining > 0) {
      const progress = getDeliveryProgress(
        order.quantity ?? "-",
        order.delivered_quantity ?? "-"
      );
      if (progress.delivered > 0) return true;
    }
  }

  return false;
}

export function hasKnownZdFulfillmentDocId(
  order: Pick<IndividualOrder, "zd_fulfillment_dok_id">
): boolean {
  const id = order.zd_fulfillment_dok_id;
  return id != null && Number.isFinite(id) && Math.trunc(id) > 0;
}

/** TTL odświeżenia terminu — krótszy gdy znamy dok_id (tanie GET po ZD). */
export function zdEtaSyncTtlMsForOrder(
  order: Pick<
    IndividualOrder,
    "zd_fulfillment_source" | "zd_fulfillment_dok_id"
  >
): number {
  if (order.zd_fulfillment_source !== "zd") return ZD_ETA_SYNC_MISS_TTL_MS;
  return hasKnownZdFulfillmentDocId(order)
    ? ZD_ETA_SYNC_KNOWN_ZD_TTL_MS
    : ZD_ETA_SYNC_TTL_MS;
}

export function needsZdEtaSync(
  order: IndividualOrder,
  stats: ReturnType<typeof statsBySupplierId>[string] | undefined,
  statsMode: StatsMode,
  nowMs: number,
  force = false
): boolean {
  if (!isZdEtaSyncEligible(order)) return false;

  if (!order.zd_fulfillment_synced_at) return true;
  if (force) return true;

  if (
    order.status === "Czesciowo_zrealizowane" &&
    orderHasPartialDeliveryRemaining(order) &&
    (order.zd_fulfillment_source === "zd" || hasKnownZdFulfillmentDocId(order))
  ) {
    return true;
  }

  if (
    order.zd_fulfillment_source === "zd" &&
    !hasPersistedZdFulfillment(order, new Date(nowMs))
  ) {
    return true;
  }

  const syncedAt = new Date(order.zd_fulfillment_synced_at).getTime();
  if (!Number.isFinite(syncedAt)) return true;
  const ttl = zdEtaSyncTtlMsForOrder(order);
  return nowMs - syncedAt >= ttl;
}

export type ZdFulfillmentPersistMissAction = "clear" | "touch" | "retain";

/**
 * Przy braku dopasowania: zachowaj aktywny termin ZD; czyść tylko gdy brak ważnego zapisu.
 * retain — nie aktualizuj bazy (offline / timeout przy znanym terminie → szybsza ponowna próba).
 */
export function zdFulfillmentPersistOnMissAction(
  _force: boolean | undefined,
  retainExistingZd: boolean,
  ctx: ZdFulfillmentMissContext = {}
): ZdFulfillmentPersistMissAction {
  if (ctx.knownZdInactive) return "clear";
  if (retainExistingZd && (ctx.subiektOffline || ctx.searchIncomplete)) return "retain";
  if (ctx.subiektOffline || ctx.searchIncomplete) return "touch";
  if (retainExistingZd) return "touch";
  return "clear";
}

/** Gwarantowany budżet dokumentów na jedną pozycję w przebiegu sync. */
export function zdEtaPerOrderDocBudget(
  globalRemaining: number,
  ordersRemainingInRun: number
): number {
  if (globalRemaining <= 0 || ordersRemainingInRun <= 0) return 0;
  const fairShare = Math.ceil(globalRemaining / ordersRemainingInRun);
  const floor = Math.min(ZD_ETA_EXTENDED_DOCS_PER_ORDER, 24);
  return Math.min(ZD_ETA_EXTENDED_DOCS_PER_ORDER, Math.max(fairShare, floor));
}

/** Czy zachować wcześniej zsynchronizowany termin ZD przy braku nowego dopasowania. */
export function hasPersistedZdFulfillment(
  order: Pick<IndividualOrder, "zd_fulfillment_source" | "zd_fulfillment_deadline">,
  at: Date = new Date()
): boolean {
  if (order.zd_fulfillment_source !== "zd") return false;
  const deadline = order.zd_fulfillment_deadline?.trim();
  if (!deadline) return false;
  return isActiveZdFulfillmentDeadline(deadline, at);
}

/** Priorytet pozycji w obrębie jednego dostawcy (niżej = wcześniej). */
export function zdEtaSyncSupplierOrderPriority(
  order: IndividualOrder,
  at: Date = new Date()
): number {
  if (
    orderHasPartialDeliveryRemaining(order) &&
    hasKnownZdFulfillmentDocId(order)
  ) {
    return 0;
  }
  if (
    order.zd_fulfillment_source === "zd" &&
    hasKnownZdFulfillmentDocId(order)
  ) {
    return 1;
  }
  return zdEtaSyncOrderPriority(order, at) + 10;
}

/** Niższy wynik = wyższy priorytet w sync (przeterminowany ZD przed odświeżeniem aktywnych). */
export function zdEtaSyncOrderPriority(
  order: Pick<
    IndividualOrder,
    | "zd_fulfillment_source"
    | "zd_fulfillment_deadline"
    | "zd_fulfillment_synced_at"
  >,
  at: Date = new Date()
): number {
  if (order.zd_fulfillment_source === "zd" && !hasPersistedZdFulfillment(order, at)) {
    return 0;
  }
  if (!order.zd_fulfillment_synced_at || !order.zd_fulfillment_source) {
    return 1;
  }
  return 2;
}

/** Wybór kandydatów do synchronizacji (testowalne). */
export function selectZdEtaSyncCandidates(
  orders: IndividualOrder[],
  statsMap: Record<string, ReturnType<typeof statsBySupplierId>[string] | undefined>,
  supplierById: Map<string, SupplierRef>,
  nowMs: number,
  options?: Pick<ZdEtaSyncOptions, "force" | "maxOrders">
): IndividualOrder[] {
  const candidates = orders.filter((order) => {
    const supplier = order.supplier_id ? supplierById.get(order.supplier_id) : undefined;
    const statsMode = (order.supplier?.stats_mode ?? "LACZNIE") as StatsMode;
    if (!supplierHasSubiektKh(supplier)) return false;
    return needsZdEtaSync(
      order,
      statsMap[order.supplier_id!],
      statsMode,
      nowMs,
      options?.force
    );
  });

  candidates.sort((a, b) => {
    const partialKnownRank = (o: IndividualOrder) =>
      orderHasPartialDeliveryRemaining(o) && hasKnownZdFulfillmentDocId(o)
        ? 0
        : hasKnownZdFulfillmentDocId(o) && o.zd_fulfillment_source === "zd"
          ? 1
          : 2;
    const pka = partialKnownRank(a);
    const pkb = partialKnownRank(b);
    if (pka !== pkb) return pka - pkb;
    const pa = zdEtaSyncOrderPriority(a, new Date(nowMs));
    const pb = zdEtaSyncOrderPriority(b, new Date(nowMs));
    if (pa !== pb) return pa - pb;
    const retryRank = (o: IndividualOrder) =>
      o.zd_fulfillment_synced_at && !o.zd_fulfillment_source ? 0 : 1;
    const ra = retryRank(a);
    const rb = retryRank(b);
    if (ra !== rb) return ra - rb;
    const placementA = orderPlacementAt(a) ?? "";
    const placementB = orderPlacementAt(b) ?? "";
    if (!placementA && placementB) return 1;
    if (placementA && !placementB) return -1;
    return placementA.localeCompare(placementB);
  });

  if (options?.maxOrders != null && options.maxOrders > 0) {
    return candidates.slice(0, options.maxOrders);
  }
  return candidates;
}

/** Liczba pozycji kwalifikujących się do sync ZD (pending lub ponowna próba po TTL). */
export function countZdEtaSyncTriggers(
  orders: IndividualOrder[],
  statsRows: Awaited<ReturnType<typeof fetchDeliveryStats>>
): number {
  const statsMap = statsBySupplierId(statsRows);
  const nowMs = Date.now();
  return orders.filter((order) => {
    if (order.sales_acknowledged_at) return false;
    const statsMode = (order.supplier?.stats_mode ?? "LACZNIE") as StatsMode;
    return needsZdEtaSync(
      order,
      order.supplier_id ? statsMap[order.supplier_id] : undefined,
      statsMode,
      nowMs,
      false
    );
  }).length;
}

/**
 * Pozycje kwalifikujące się do sync ZD na /moje (bez sprawdzania reachability Subiekta).
 */
export function countZdEtaMojeSyncableOrders(
  orders: IndividualOrder[],
  statsRows: Awaited<ReturnType<typeof fetchDeliveryStats>>,
  suppliers: SupplierRef[]
): number {
  const statsMap = statsBySupplierId(statsRows);
  const supplierById = new Map(suppliers.map((s) => [s.id, s]));
  const nowMs = Date.now();
  return orders.filter((order) => {
    if (order.sales_acknowledged_at) return false;
    const supplier = order.supplier_id ? supplierById.get(order.supplier_id) : undefined;
    if (!supplierHasSubiektKh(supplier)) return false;
    const statsMode = (order.supplier?.stats_mode ?? "LACZNIE") as StatsMode;
    return needsZdEtaSync(
      order,
      order.supplier_id ? statsMap[order.supplier_id] : undefined,
      statsMode,
      nowMs,
      false
    );
  }).length;
}

/**
 * Pozycje kwalifikujące się do synchronizacji terminu ZD na /moje (force + live search).
 * Obejmuje: brak sync, częściową realizację, wygasły termin ZD, odświeżenie po TTL.
 */
export function countZdEtaMojeClientSyncTriggers(
  orders: IndividualOrder[],
  statsRows: Awaited<ReturnType<typeof fetchDeliveryStats>>,
  suppliers: SupplierRef[],
  subiektReachable = true
): number {
  if (!subiektReachable) return 0;
  return countZdEtaMojeSyncableOrders(orders, statsRows, suppliers);
}

/** Czy zamontować klienta auto-sync (również gdy Subiekt chwilowo offline). */
export function countZdEtaMojeClientSyncMount(
  orders: IndividualOrder[],
  statsRows: Awaited<ReturnType<typeof fetchDeliveryStats>>,
  suppliers: SupplierRef[]
): number {
  return countZdEtaMojeSyncableOrders(orders, statsRows, suppliers);
}

function supplierKhIds(supplier: SupplierRef | undefined): number[] {
  if (!supplier) return [];
  return collectKhIdsForSupplierRef(supplier);
}

function supplierHasSubiektKh(supplier: SupplierRef | undefined): boolean {
  return supplierKhIds(supplier).length > 0;
}

function isTimeBudgetExceeded(startedMs: number, maxDurationMs: number): boolean {
  return Date.now() - startedMs >= maxDurationMs;
}

/** kh_Id z indeksu ZD (aliasy kontrahenta widoczne w katalogu, np. dwie nazwy Marrodent). */
export async function loadExtraKhIdsBySupplierIdFromZdIndex(): Promise<Map<string, number[]>> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("subiekt_zd_index")
    .select("supplier_id, subiekt_kh_id")
    .not("supplier_id", "is", null);
  if (error) throw new Error(error.message);

  const map = new Map<string, Set<number>>();
  for (const row of data ?? []) {
    const supplierId = (row as { supplier_id: string | null }).supplier_id;
    const kh = Math.trunc(Number((row as { subiekt_kh_id: number }).subiekt_kh_id));
    if (!supplierId || !Number.isFinite(kh) || kh <= 0) continue;
    const set = map.get(supplierId) ?? new Set<number>();
    set.add(kh);
    map.set(supplierId, set);
  }

  const out = new Map<string, number[]>();
  for (const [supplierId, ids] of map) out.set(supplierId, [...ids]);
  return out;
}

export function resolveSupplierKhIds(
  supplier: SupplierRef | undefined,
  supplierId: string,
  extraKhBySupplierId: Map<string, number[]>
): number[] {
  const ids = new Set(supplierKhIds(supplier));
  for (const kh of extraKhBySupplierId.get(supplierId) ?? []) {
    if (Number.isFinite(kh) && kh > 0) ids.add(Math.trunc(kh));
  }
  return [...ids];
}

/** Czy dokument ZD należy do kontrahenta dostawcy (kh_Id główny lub alias). */
export function zdDocumentMatchesSupplierKhIds(
  doc: SubiektDocument,
  khIds: readonly number[]
): boolean {
  const allowed = new Set(
    khIds.map((id) => Math.trunc(id)).filter((id) => Number.isFinite(id) && id > 0)
  );
  if (!allowed.size) return false;
  return extractDocKhIds(doc).some((id) => allowed.has(id));
}

function findMatchingZdDocumentForSupplier(
  order: IndividualOrder,
  docs: SubiektDocument[],
  khIds: readonly number[]
): SubiektDocument | null {
  const scoped = docs.filter((doc) => zdDocumentMatchesSupplierKhIds(doc, khIds));
  return findBestMatchingZdDocument(order, scoped);
}

/** Wczesne zatrzymanie odczytu indeksu — wybór najlepszego z pobranych, stop przy pewnym trafieniu. */
export function buildZdIndexSearchEarlyStopHandlers(
  order: IndividualOrder,
  khIds: readonly number[]
): Pick<
  import("@/lib/subiekt/zd-eta-index-search").FetchZdByDokIdsOptions,
  "selectBestFromDocs" | "shouldStopAfterBest"
> {
  return {
    selectBestFromDocs: (docs) => findMatchingZdDocumentForSupplier(order, docs, khIds),
    shouldStopAfterBest: (best, ctx) =>
      isConfidentZdMatchForOrder(order, best) || ctx.fetched >= ctx.listedCount,
  };
}

function orderZdConfidentMatchDoc(
  order: IndividualOrder,
  khIds: readonly number[]
): (doc: SubiektDocument) => boolean {
  return (doc) =>
    Boolean(findMatchingZdDocumentForSupplier(order, [doc], khIds)) &&
    isConfidentZdMatchForOrder(order, doc);
}

async function fetchZdDocumentSafe(
  dokId: number,
  options?: { forceFresh?: boolean }
): Promise<SubiektDocument | null> {
  try {
    return await getSubiektZdDocumentCached(dokId, options);
  } catch (e) {
    if (isSubiektOfflineError(e)) throw e;
    return null;
  }
}

/** Szybka ścieżka: ponowny odczyt zapisanego dokumentu ZD (zmiana terminu przez zakupy). */
export type KnownZdRefreshResult =
  | { kind: "active"; doc: SubiektDocument }
  | { kind: "inactive" }
  | { kind: "missing" };

export async function refreshKnownZdDocumentForOrder(
  order: IndividualOrder,
  loadDoc: (dokId: number) => Promise<SubiektDocument | null>,
  khIds: readonly number[],
  at: Date = new Date()
): Promise<KnownZdRefreshResult> {
  if (!hasKnownZdFulfillmentDocId(order)) return { kind: "missing" };
  const dokId = Math.trunc(order.zd_fulfillment_dok_id!);
  const doc = await loadDoc(dokId);
  if (!doc) return { kind: "missing" };
  if (!zdDocumentMatchesSupplierKhIds(doc, khIds)) return { kind: "missing" };
  if (!orderMatchesZdDocument(order, doc)) return { kind: "missing" };
  if (!persistedZdFulfillsOrderRemaining(order, doc, at)) return { kind: "inactive" };
  return { kind: "active", doc };
}

export async function tryRefreshKnownZdDocumentForOrder(
  order: IndividualOrder,
  loadDoc: (dokId: number) => Promise<SubiektDocument | null>,
  khIds: readonly number[],
  at: Date = new Date()
): Promise<SubiektDocument | null> {
  const refreshed = await refreshKnownZdDocumentForOrder(order, loadDoc, khIds, at);
  return refreshed.kind === "active" ? refreshed.doc : null;
}

export async function liveSearchZdDocsByTwIdForOrder(
  order: IndividualOrder,
  khIds: readonly number[],
  remainingDocBudget: number,
  knownDocIds: ReadonlySet<number>,
  loadDoc: (dokId: number) => Promise<SubiektDocument | null>
): Promise<{ doc: SubiektDocument | null; peeked: number }> {
  const twId = Math.trunc(Number(order.subiekt_tw_id));
  if (remainingDocBudget <= 0 || !khIds.length || !Number.isFinite(twId) || twId <= 0) {
    return { doc: null, peeked: 0 };
  }

  const placement = zdSearchPlacementAt(order);
  let peeked = 0;

  const tryListItem = async (
    item: Pick<SubiektDocument, "dok_Id">
  ): Promise<SubiektDocument | null> => {
    const id = Math.trunc(Number(item.dok_Id));
    if (!Number.isFinite(id) || id <= 0 || knownDocIds.has(id)) return null;

    const preview = await getSubiektZdDocumentCached(id);
    peeked++;
    if (!preview || !zdDocumentContainsTowId(preview, twId)) return null;
    if (!zdDocumentMatchesSupplierKhIds(preview, khIds)) return null;
    const hit = findMatchingZdDocumentForSupplier(order, [preview], khIds);
    if (!hit) return null;

    const loaded = await loadDoc(id);
    return loaded ?? hit;
  };

  const monthChunks = zdTwIdBrowseMonthChunks(placement);
  for (const chunk of monthChunks) {
    if (peeked >= remainingDocBudget) break;

    for (let page = 1; page <= ZD_ETA_TW_ID_BROWSE_MAX_PAGES_PER_CHUNK; page++) {
      if (peeked >= remainingDocBudget) break;

      const list = await searchSubiektZdCachedForEta({
        dataOd: chunk.dataOd,
        dataDo: chunk.dataDo,
        page,
        pageSize: 25,
      });
      const items = list.data ?? [];
      if (!items.length) break;

      const { open: openItems, later: laterItems } = partitionZdListItemsForEtaLoad(items);
      for (const item of [...openItems, ...laterItems]) {
        if (peeked >= remainingDocBudget) break;
        if (!zdListItemMatchesSupplierKhIds(item, khIds)) continue;
        const doc = await tryListItem(item);
        if (doc) return { doc, peeked };
      }

      if (items.length < 25) break;
    }
  }

  const dataOd = zdTwIdListDataOd(placement);
  for (let page = 1; page <= ZD_ETA_TW_ID_LIVE_SEARCH_MAX_PAGES; page++) {
    if (peeked >= remainingDocBudget) break;

    const list = await searchSubiektZdCachedForEta({
      id: twId,
      dataOd,
      page,
      pageSize: 25,
    });
    const items = list.data ?? [];
    if (!items.length) break;

    const { open: openItems, later: laterItems } = partitionZdListItemsForEtaLoad(items);
    for (const item of [...openItems, ...laterItems]) {
      if (peeked >= remainingDocBudget) break;
      if (!zdListItemMatchesSupplierKhIds(item, khIds)) continue;
      const doc = await tryListItem(item);
      if (doc) return { doc, peeked };
    }

    if (items.length < 25) break;
  }

  return { doc: null, peeked };
}

export async function liveSearchZdDocsForOrder(
  order: IndividualOrder,
  khIds: readonly number[],
  maxPlans: number,
  remainingDocBudget: number,
  remainingSupplierDocBudget: number,
  knownDocIds: ReadonlySet<number>,
  loadDoc: (dokId: number) => Promise<SubiektDocument | null>
): Promise<{ docs: SubiektDocument[]; fetched: number; matched: SubiektDocument | null }> {
  const docBudget = Math.min(remainingDocBudget, remainingSupplierDocBudget);
  if (docBudget <= 0) return { docs: [], fetched: 0, matched: null };
  const allPlans = zdSearchPlansForOrderWithKhIds(
    {
      symbol: order.symbol,
      products: order.products,
      subiekt_tw_id: order.subiekt_tw_id,
      placementAt: zdSearchPlacementAt(order),
    },
    khIds
  );
  const plans = prioritizeZdLiveSearchPlans(allPlans, {
    primaryKhId: khIds[0] ?? null,
    maxPlans,
  });

  const docs: SubiektDocument[] = [];
  const seen = new Set<number>();
  let fetched = 0;

  for (const plan of plans) {
    if (fetched >= docBudget) break;
    const planTwId =
      plan.id != null && Number(plan.id) > 0 ? Math.trunc(Number(plan.id)) : null;
    const maxPages =
      planTwId != null ? ZD_ETA_TW_ID_LIVE_SEARCH_MAX_PAGES : ZD_ETA_LIVE_SEARCH_MAX_PAGES;
    for (let page = 1; page <= maxPages; page++) {
      if (fetched >= docBudget) break;
      const list = await searchSubiektZdCachedForEta({ ...plan, page });
      const items = list.data ?? [];
      if (!items.length) break;
      const { open: openItems, later: laterItems } = partitionZdListItemsForEtaLoad(items);
      for (const item of [...openItems, ...laterItems]) {
        if (fetched >= docBudget) break;
        const id = Math.trunc(Number(item.dok_Id));
        if (!Number.isFinite(id) || id <= 0 || seen.has(id) || knownDocIds.has(id)) {
          continue;
        }
        if (khIds.length > 0 && !zdListItemMatchesSupplierKhIds(item, khIds)) {
          continue;
        }
        seen.add(id);
        const preview = planTwId != null ? await getSubiektZdDocumentCached(id) : null;
        if (planTwId != null) {
          if (!preview || !zdDocumentContainsTowId(preview, planTwId)) continue;
        }
        const full = await loadDoc(id);
        if (!full) continue;
        if (planTwId != null && !zdDocumentContainsTowId(full, planTwId)) continue;
        fetched++;
        if (!zdDocumentMatchesSupplierKhIds(full, khIds)) continue;
        docs.push(full);
        const hit = findMatchingZdDocumentForSupplier(order, [full], khIds);
        if (hit) return { docs, fetched, matched: hit };
      }
      if (items.length < (plan.pageSize ?? 12)) break;
    }
  }

  const matched = findMatchingZdDocumentForSupplier(order, docs, khIds);
  return { docs, fetched, matched };
}

/** Po wykryciu nieaktywnego zapisanego ZD — szuka nowego dokumentu po tw_Id u dostawcy. */
export async function searchReplacementZdForInactiveKnown(
  order: IndividualOrder,
  khIds: readonly number[],
  knownDocIds: ReadonlySet<number>,
  loadDoc: (dokId: number) => Promise<SubiektDocument | null>,
  remainingBudget: number,
  at: Date = new Date()
): Promise<{ doc: SubiektDocument | null; fetched: number }> {
  if (remainingBudget <= 0 || !khIds.length) {
    return { doc: null, fetched: 0 };
  }

  const placement = zdSearchPlacementAt(order);
  const browseMonthChunks = placement
    ? sortMonthChunksNearPlacement(zdPlacementBrowseMonthChunks(placement, at), placement)
    : undefined;
  const dataOd = zdContractorExtendedDataOdForPlacement(placement, at);

  const browse = await browseZdDocumentsForKhIds({
    khIds,
    dataOd: browseMonthChunks?.[0]?.dataOd ?? dataOd,
    monthChunks: browseMonthChunks,
    pageSize: 25,
    maxPagesPerKh: ZD_ETA_REPLACEMENT_SEARCH_MAX_PAGES,
    maxDocsToFetch: remainingBudget,
    skipDocIds: knownDocIds,
    loadDoc,
    preferIssueDateNear: placement ?? undefined,
    matchDoc: (doc) =>
      Boolean(findMatchingZdDocumentForSupplier(order, [doc], khIds)),
  });

  const doc =
    browse.matched ??
    findMatchingZdDocumentForSupplier(order, browse.docs, khIds);
  return { doc, fetched: browse.fetched };
}

async function touchZdFulfillmentSync(orderId: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("individual_orders")
    .update({ zd_fulfillment_synced_at: new Date().toISOString() })
    .eq("id", orderId);

  if (error) throw new Error(error.message);
}

async function persistZdFulfillment(
  order: Pick<
    IndividualOrder,
    | "id"
    | "zd_fulfillment_deadline"
    | "zd_fulfillment_previous_deadline"
    | "zd_fulfillment_deadline_changed_at"
    | "zd_fulfillment_deadline_change_seen_at"
  >,
  input: {
    deadline: string | null;
    dokNr: string | null;
    dokId: number | null;
    source: "zd" | null;
  }
): Promise<void> {
  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const changeFields = buildZdFulfillmentDeadlineChangePersistFields(
    order,
    input.deadline,
    now
  );
  const { error } = await supabase
    .from("individual_orders")
    .update({
      zd_fulfillment_deadline: input.deadline,
      zd_fulfillment_source: input.source,
      zd_fulfillment_dok_nr: input.dokNr,
      zd_fulfillment_dok_id: input.dokId,
      zd_fulfillment_synced_at: now,
      ...changeFields,
    })
    .eq("id", order.id);

  if (error) throw new Error(error.message);
}

/** Sync terminów ZD dla jednego handlowca — wywoływany w tle z /moje (after). */
async function fetchZdEtaSyncOrderPool(salesPersonId?: string): Promise<IndividualOrder[]> {
  const supabase = createAdminClient();

  const buildBaseQuery = () =>
    supabase
      .from("individual_orders")
      .select("*, supplier:suppliers(*)")
      .in("status", ["Zamowione", "Czesciowo_zrealizowane"])
      .eq("request_kind", "zamowienie")
      .is("sales_acknowledged_at", null);

  if (salesPersonId) {
    const res = await buildBaseQuery().eq("sales_person_id", salesPersonId);
    if (res.error) throw new Error(res.error.message);
    return normalizeIndividualOrders(res.data ?? []);
  }

  const all: IndividualOrder[] = [];
  for (
    let offset = 0;
    offset < ZD_ETA_GLOBAL_ORDER_SCAN_MAX;
    offset += ZD_ETA_GLOBAL_ORDER_SCAN_PAGE
  ) {
    const res = await buildBaseQuery()
      .order("ordered_at", { ascending: true, nullsFirst: false })
      .order("action_at", { ascending: true })
      .range(offset, offset + ZD_ETA_GLOBAL_ORDER_SCAN_PAGE - 1);
    if (res.error) throw new Error(res.error.message);
    const batch = normalizeIndividualOrders(res.data ?? []);
    if (!batch.length) break;
    all.push(...batch);
    if (batch.length < ZD_ETA_GLOBAL_ORDER_SCAN_PAGE) break;
  }
  return all;
}

export async function runZdEtaSyncForSalesPerson(
  salesPersonId: string,
  options?: Pick<ZdEtaSyncOptions, "force" | "allowLiveSearch">
): Promise<ZdEtaSyncResult> {
  const manualRefresh = Boolean(options?.force);
  return runZdEtaSync({
    salesPersonId,
    maxOrders: manualRefresh ? ZD_ETA_MOJE_FORCE_MAX_ORDERS : ZD_ETA_MOJE_MAX_ORDERS,
    maxDocsPerRun: manualRefresh ? ZD_ETA_MOJE_FORCE_MAX_DOCS : ZD_ETA_MOJE_MAX_DOCS,
    maxDocsPerSupplier: manualRefresh
      ? Math.min(48, ZD_ETA_MOJE_FORCE_MAX_DOCS)
      : Math.min(32, ZD_ETA_MOJE_MAX_DOCS),
    indexLimitPerSupplier: ZD_ETA_MOJE_INDEX_LIMIT_PER_SUPPLIER,
    maxDurationMs: manualRefresh
      ? ZD_ETA_MOJE_FORCE_MAX_DURATION_MS
      : ZD_ETA_MOJE_MAX_DURATION_MS,
    allowLiveSearch: options?.allowLiveSearch ?? false,
    force: options?.force,
  });
}

/** Globalny backup po nocnym catalog-zd-sync (bez nowego crona). */
export async function runZdEtaSyncGlobalBackup(): Promise<ZdEtaSyncResult> {
  return runZdEtaSync({
    maxDurationMs: 120_000,
    maxOrders: 48,
    maxDocsPerRun: 96,
    maxDocsPerSupplier: 48,
    allowLiveSearch: true,
  });
}

export async function runZdEtaSync(options: ZdEtaSyncOptions = {}): Promise<ZdEtaSyncResult> {
  const maxDurationMs = options.maxDurationMs ?? 3 * 60 * 1000;
  const maxDocsPerRun = options.maxDocsPerRun ?? ZD_ETA_MAX_DOCS_PER_RUN;
  const maxDocsPerSupplier = options.maxDocsPerSupplier ?? ZD_ETA_MAX_DOCS_PER_SUPPLIER;
  const indexLimitPerSupplier =
    options.indexLimitPerSupplier ?? ZD_ETA_INDEX_LIMIT_PER_SUPPLIER;
  const allowLiveSearch = options.allowLiveSearch ?? true;
  const started = Date.now();
  const empty: ZdEtaSyncResult = {
    ok: true,
    candidates: 0,
    processed: 0,
    updated: 0,
    cleared: 0,
    docsFetched: 0,
  };

  if (!(await isSubiektReachable())) {
    return { ...empty, skipped: true, reason: "subiekt_offline", subiektOffline: true };
  }

  const lockKey = zdEtaSyncLockKey(options.salesPersonId);
  const locked = await tryAcquireLock(lockKey, 240, "zd_eta_sync");
  if (!locked) {
    return { ...empty, skipped: true, reason: "lock_held" };
  }

  try {
    const [orders, statsRows, suppliers] = await Promise.all([
      fetchZdEtaSyncOrderPool(options.salesPersonId),
      fetchDeliveryStats(),
      options.supplierRefs
        ? Promise.resolve(options.supplierRefs)
        : getAppSupplierRefsCached(),
    ]);

    const statsMap = statsBySupplierId(statsRows);
    const supplierById = new Map(suppliers.map((s) => [s.id, s]));
    const nowMs = Date.now();

    const candidates = selectZdEtaSyncCandidates(
      orders,
      statsMap,
      supplierById,
      nowMs,
      { force: options.force, maxOrders: options.maxOrders }
    );

    const extraKhBySupplierId = await loadExtraKhIdsBySupplierIdFromZdIndex();
    const syncAt = new Date(nowMs);

    const bySupplier = new Map<string, IndividualOrder[]>();
    for (const order of candidates) {
      const sid = order.supplier_id!;
      const list = bySupplier.get(sid) ?? [];
      list.push(order);
      bySupplier.set(sid, list);
    }

    const fairSupplierDocCap = Math.max(
      ZD_ETA_INITIAL_POOL_MAX_DOCS + ZD_ETA_EXTENDED_DOCS_PER_ORDER,
      Math.ceil(maxDocsPerRun / Math.max(1, bySupplier.size))
    );

    const supplierEntries = [...bySupplier.entries()].sort((a, b) => {
      const partialKnownSupplier = (orders: IndividualOrder[]) =>
        orders.some(
          (o) =>
            orderHasPartialDeliveryRemaining(o) && hasKnownZdFulfillmentDocId(o)
        )
          ? 0
          : orders.some(
                (o) =>
                  o.zd_fulfillment_source === "zd" && hasKnownZdFulfillmentDocId(o)
              )
            ? 1
            : 2;
      const sa = partialKnownSupplier(a[1]);
      const sb = partialKnownSupplier(b[1]);
      if (sa !== sb) return sa - sb;
      const priorityScore = (orders: IndividualOrder[]) =>
        Math.min(...orders.map((o) => zdEtaSyncSupplierOrderPriority(o, syncAt)));
      const pa = priorityScore(a[1]);
      const pb = priorityScore(b[1]);
      if (pa !== pb) return pa - pb;
      const retryScore = (orders: IndividualOrder[]) =>
        orders.some((o) => o.zd_fulfillment_synced_at && !o.zd_fulfillment_source) ? 0 : 1;
      const ra = retryScore(a[1]);
      const rb = retryScore(b[1]);
      if (ra !== rb) return ra - rb;
      return b[1].length - a[1].length;
    });

    let candidatesRemaining = candidates.length;
    let processed = 0;
    let updated = 0;
    let cleared = 0;
    let docsFetched = 0;
    let subiektOffline = false;
    let timedOut = false;

    const persistOrderMatch = async (
      order: IndividualOrder,
      matched: SubiektDocument | null,
      orderSearchIncomplete: boolean,
      knownZdInactive = false
    ): Promise<void> => {
      const retainExistingZd =
        !knownZdInactive && hasPersistedZdFulfillment(order, syncAt);
      const missAction = zdFulfillmentPersistOnMissAction(options.force, retainExistingZd, {
        subiektOffline,
        searchIncomplete: orderSearchIncomplete,
        knownZdInactive,
      });

      if (!matched) {
        const clearExpiredPersistedZd =
          order.zd_fulfillment_source === "zd" &&
          !hasPersistedZdFulfillment(order, syncAt);
        if (missAction === "retain") {
          return;
        }
        if (missAction === "touch" && !clearExpiredPersistedZd) {
          await touchZdFulfillmentSync(order.id);
        } else {
          await persistZdFulfillment(order, {
            deadline: null,
            dokNr: null,
            dokId: null,
            source: null,
          });
          cleared++;
        }
        return;
      }

      const deadline = parseZdFulfillmentDeadline(matched);
      const dokNr = matched.dok_NrPelny?.trim() || `ZD #${matched.dok_Id}`;
      const dokId = Math.trunc(Number(matched.dok_Id));

      if (!deadline) {
        if (missAction === "retain") {
          return;
        }
        if (missAction === "touch") {
          await touchZdFulfillmentSync(order.id);
        } else {
          await persistZdFulfillment(order, {
            deadline: null,
            dokNr: null,
            dokId: null,
            source: null,
          });
          cleared++;
        }
        return;
      }

      await persistZdFulfillment(order, {
        deadline,
        dokNr,
        dokId: Number.isFinite(dokId) && dokId > 0 ? dokId : null,
        source: "zd",
      });
      updated++;
    };

    supplierLoop: for (const [supplierId, supplierOrders] of supplierEntries) {
      if (isTimeBudgetExceeded(started, maxDurationMs)) {
        timedOut = true;
        break;
      }

      const supplier = supplierById.get(supplierId);
      const khIds = resolveSupplierKhIds(supplier, supplierId, extraKhBySupplierId);
      if (!khIds.length) continue;

      const supplierPlacements = supplierOrders.map((o) => zdSearchPlacementAt(o));
      const supplierInitialDataOd = earliestZdContractorInitialDataOd(
        supplierPlacements,
        syncAt
      );

      const supplierExtendedDataOd = earliestZdContractorExtendedDataOd(
        supplierPlacements,
        syncAt
      );

      const supplierDocCache = new Map<number, SubiektDocument>();
      let supplierDocsFetched = 0;
      let supplierRunDocsFetched = 0;
      const sharedDocs: SubiektDocument[] = [];
      const sharedDocIds = new Set<number>();

      const initialPoolCap = Math.min(
        ZD_ETA_INITIAL_POOL_MAX_DOCS,
        maxDocsPerSupplier
      );

      const loadDoc = async (
        dokId: number,
        opts?: { countTowardSupplier?: boolean; forceFresh?: boolean }
      ): Promise<SubiektDocument | null> => {
        if (!opts?.forceFresh) {
          const cached = supplierDocCache.get(dokId);
          if (cached) return cached;
        }
        if (docsFetched >= maxDocsPerRun) return null;
        if (supplierRunDocsFetched >= fairSupplierDocCap) return null;
        if (
          opts?.countTowardSupplier !== false &&
          supplierDocsFetched >= maxDocsPerSupplier
        ) {
          return null;
        }
        try {
          const doc = await fetchZdDocumentSafe(dokId, {
            forceFresh: opts?.forceFresh ?? options.force,
          });
          supplierRunDocsFetched++;
          if (opts?.countTowardSupplier !== false) supplierDocsFetched++;
          docsFetched++;
          if (doc) supplierDocCache.set(dokId, doc);
          return doc;
        } catch (e) {
          if (isSubiektOfflineError(e)) {
            subiektOffline = true;
            return null;
          }
          throw e;
        }
      };

      const shouldStopGlobal = () =>
        subiektOffline ||
        isTimeBudgetExceeded(started, maxDurationMs) ||
        docsFetched >= maxDocsPerRun ||
        supplierRunDocsFetched >= fairSupplierDocCap;

      const shouldStopInitialPool = () =>
        shouldStopGlobal() || supplierDocsFetched >= initialPoolCap;

      const loadDocExtended = (dokId: number) =>
        loadDoc(dokId, { countTowardSupplier: false });

      const fetchKnownZdDocument = async (
        dokId: number
      ): Promise<SubiektDocument | null> => {
        const cached = supplierDocCache.get(dokId);
        if (cached) return cached;
        try {
          const doc = await fetchZdDocumentSafe(dokId, { forceFresh: true });
          if (doc) supplierDocCache.set(dokId, doc);
          return doc;
        } catch (e) {
          if (isSubiektOfflineError(e)) {
            subiektOffline = true;
            return null;
          }
          throw e;
        }
      };

      const addSharedDoc = (doc: SubiektDocument) => {
        const id = Math.trunc(Number(doc.dok_Id));
        if (!Number.isFinite(id) || id <= 0 || sharedDocIds.has(id)) return;
        sharedDocIds.add(id);
        sharedDocs.push(doc);
      };

      const indexRows = await loadZdIndexRowsForSupplierSync(
        khIds,
        supplierPlacements,
        supplierExtendedDataOd,
        syncAt,
        Math.max(indexLimitPerSupplier, ZD_ETA_INDEX_LIMIT_EXTENDED)
      );

      const indexInitial = await searchZdFromIndexForOrder(indexRows, {
        maxDocsToFetch: initialPoolCap,
        skipDocIds: sharedDocIds,
        loadDoc: (id) => loadDoc(id),
        shouldStop: shouldStopInitialPool,
      });
      for (const doc of indexInitial.docs) addSharedDoc(doc);
      const initialIndexExhausted =
        indexRows.length === 0 ||
        (!indexInitial.stoppedEarly && indexInitial.fetched >= indexRows.length);

      let initialBrowseStoppedEarly = false;
      if (indexRows.length === 0 && !shouldStopInitialPool()) {
        const initialBrowse = await browseZdDocumentsForKhIds({
          khIds,
          dataOd: supplierInitialDataOd,
          pageSize: 25,
          maxPagesPerKh: ZD_ETA_INITIAL_BROWSE_MAX_PAGES_PER_KH,
          maxDocsToFetch: Math.max(0, initialPoolCap - supplierDocsFetched),
          skipDocIds: sharedDocIds,
          loadDoc: (id) => loadDoc(id),
          shouldStop: shouldStopInitialPool,
        });
        initialBrowseStoppedEarly = initialBrowse.stoppedEarly;
        for (const doc of initialBrowse.docs) addSharedDoc(doc);
      }

      for (const order of [...supplierOrders].sort(
        (a, b) =>
          zdEtaSyncSupplierOrderPriority(a, syncAt) -
          zdEtaSyncSupplierOrderPriority(b, syncAt)
      )) {
        if (isTimeBudgetExceeded(started, maxDurationMs)) {
          timedOut = true;
          break supplierLoop;
        }

        let matched: SubiektDocument | null = null;
        let knownZdInactive = false;

        if (hasKnownZdFulfillmentDocId(order)) {
          const knownRefresh = await refreshKnownZdDocumentForOrder(
            order,
            fetchKnownZdDocument,
            khIds,
            syncAt
          );
          if (knownRefresh.kind === "active") {
            matched = knownRefresh.doc;
            addSharedDoc(knownRefresh.doc);
          } else if (
            knownRefresh.kind === "inactive" ||
            knownRefresh.kind === "missing"
          ) {
            knownZdInactive = true;
            sharedDocIds.add(Math.trunc(order.zd_fulfillment_dok_id!));
          }
        }

        if (!matched) {
          matched = findMatchingZdDocumentForSupplier(order, sharedDocs, khIds);
        }

        if (subiektOffline) break supplierLoop;

        let indexStoppedEarly = false;
        let indexBudgetExhausted = false;
        let browseBudgetExhausted = false;
        let browseStoppedEarly = false;
        const orderPlacement = zdSearchPlacementAt(order);
        const orderDocBudget = zdEtaPerOrderDocBudget(
          maxDocsPerRun - docsFetched,
          candidatesRemaining
        );
        const orderIndexRows = filterZdIndexRowsForPlacement(
          indexRows,
          orderPlacement,
          syncAt
        );
        if (!matched && !shouldStopGlobal()) {
          const indexBudget = Math.min(
            orderDocBudget,
            maxDocsPerRun - docsFetched,
            fairSupplierDocCap - supplierRunDocsFetched
          );
          indexBudgetExhausted = indexBudget <= 0;
          const indexSearch = indexBudgetExhausted
            ? {
                docs: [] as SubiektDocument[],
                stoppedEarly: true,
                matched: null as SubiektDocument | null,
                listedCount: orderIndexRows.length,
                fetched: 0,
              }
            : await searchZdFromIndexForOrder(orderIndexRows, {
                maxDocsToFetch: indexBudget,
                skipDocIds: sharedDocIds,
                loadDoc: loadDocExtended,
                shouldStop: shouldStopGlobal,
                preferIssueDateNear: orderPlacement ?? undefined,
                ...buildZdIndexSearchEarlyStopHandlers(order, khIds),
              });
          indexStoppedEarly = indexSearch.stoppedEarly;
          for (const doc of indexSearch.docs) addSharedDoc(doc);
          matched =
            indexSearch.matched ??
            findMatchingZdDocumentForSupplier(order, indexSearch.docs, khIds);
        }

        const orderPlacementOld = Boolean(
          orderPlacement && placementIsOlderThanRollingWindow(orderPlacement, syncAt)
        );

        const runBrowseFallback = async (): Promise<void> => {
          if (!matched && allowLiveSearch && !shouldStopGlobal()) {
            const browseBudget = Math.min(
              orderDocBudget,
              maxDocsPerRun - docsFetched,
              fairSupplierDocCap - supplierRunDocsFetched
            );
            browseBudgetExhausted = browseBudget <= 0;
            const orderDataOd = zdContractorExtendedDataOdForPlacement(orderPlacement, syncAt);
            const orderMonthChunks = orderPlacementOld
              ? sortMonthChunksNearPlacement(
                  zdPlacementBrowseMonthChunks(orderPlacement, syncAt),
                  orderPlacement
                )
              : undefined;
            const browseFallback = browseBudgetExhausted
              ? {
                  docs: [] as SubiektDocument[],
                  stoppedEarly: true,
                  matched: null as SubiektDocument | null,
                }
              : await browseZdDocumentsForKhIds({
                  khIds,
                  dataOd: orderMonthChunks?.[0]?.dataOd ?? orderDataOd,
                  monthChunks: orderMonthChunks,
                  pageSize: 25,
                  maxPagesPerKh: ZD_ETA_EXTENDED_BROWSE_MAX_PAGES_PER_KH,
                  maxDocsToFetch: browseBudget,
                  skipDocIds: sharedDocIds,
                  loadDoc: loadDocExtended,
                  shouldStop: shouldStopGlobal,
                  preferIssueDateNear: orderPlacement ?? undefined,
                  matchDoc: orderZdConfidentMatchDoc(order, khIds),
                });
            browseStoppedEarly = browseFallback.stoppedEarly;
            for (const doc of browseFallback.docs) addSharedDoc(doc);
            matched =
              browseFallback.matched ??
              findMatchingZdDocumentForSupplier(order, browseFallback.docs, khIds);
          }
        };

        const runLiveSearch = async (): Promise<void> => {
          if (!matched && allowLiveSearch && !shouldStopGlobal()) {
            try {
              const liveBudget = Math.min(
                orderDocBudget,
                maxDocsPerRun - docsFetched,
                fairSupplierDocCap - supplierRunDocsFetched
              );
              const twSearch = await liveSearchZdDocsByTwIdForOrder(
                order,
                khIds,
                liveBudget,
                sharedDocIds,
                loadDocExtended
              );
              if (twSearch.doc) {
                addSharedDoc(twSearch.doc);
                matched = findMatchingZdDocumentForSupplier(order, [twSearch.doc], khIds);
              }
              if (!matched) {
                const { docs: liveDocs, matched: liveMatched } =
                  await liveSearchZdDocsForOrder(
                    order,
                    khIds,
                    ZD_ETA_MAX_LIVE_SEARCH_PLANS,
                    liveBudget,
                    liveBudget,
                    sharedDocIds,
                    loadDocExtended
                  );
                for (const doc of liveDocs) addSharedDoc(doc);
                matched =
                  liveMatched ??
                  findMatchingZdDocumentForSupplier(order, sharedDocs, khIds);
              }
            } catch (e) {
              if (isSubiektOfflineError(e)) {
                subiektOffline = true;
                throw e;
              }
              throw e;
            }
          }
        };

        try {
          if (orderPlacementOld) {
            await runBrowseFallback();
          }
          await runLiveSearch();
          if (!orderPlacementOld) {
            await runBrowseFallback();
          }
        } catch (e) {
          if (subiektOffline) break supplierLoop;
          throw e;
        }

        if (!matched && knownZdInactive && !shouldStopGlobal()) {
          const replacementBudget = Math.min(
            orderDocBudget,
            ZD_ETA_REPLACEMENT_SEARCH_MAX_PAGES * 25,
            ZD_ETA_EXTENDED_DOCS_PER_ORDER
          );
          const loadReplacementDoc = async (
            dokId: number
          ): Promise<SubiektDocument | null> => {
            const cached = supplierDocCache.get(dokId);
            if (cached) return cached;
            try {
              const doc = await fetchZdDocumentSafe(dokId, { forceFresh: true });
              if (doc) supplierDocCache.set(dokId, doc);
              return doc;
            } catch (e) {
              if (isSubiektOfflineError(e)) {
                subiektOffline = true;
                return null;
              }
              throw e;
            }
          };
          const replacement = await searchReplacementZdForInactiveKnown(
            order,
            khIds,
            sharedDocIds,
            loadReplacementDoc,
            replacementBudget,
            syncAt
          );
          if (replacement.doc) {
            matched = replacement.doc;
            addSharedDoc(replacement.doc);
          }
        }

        const orderSearchIncomplete =
          subiektOffline ||
          timedOut ||
          (!matched &&
            (indexBudgetExhausted ||
              browseBudgetExhausted ||
              indexStoppedEarly ||
              browseStoppedEarly ||
              initialBrowseStoppedEarly ||
              !initialIndexExhausted ||
              docsFetched >= maxDocsPerRun ||
              supplierRunDocsFetched >= fairSupplierDocCap ||
              isTimeBudgetExceeded(started, maxDurationMs)));

        await persistOrderMatch(order, matched, orderSearchIncomplete, knownZdInactive);
        processed++;
        candidatesRemaining--;
      }

      if (subiektOffline) break;
    }

    // Nie oznaczaj nieprzetworzonych kandydatów jako „brak ZD” — timeout, limit
    // dokumentów lub Subiekt offline to częściowy przebieg; kolejna próba ma szansę dopasować.

    return {
      ok: !subiektOffline,
      subiektOffline,
      candidates: candidates.length,
      processed,
      updated,
      cleared,
      docsFetched,
      timedOut: timedOut || undefined,
    };
  } finally {
    await releaseLock(lockKey);
  }
}
