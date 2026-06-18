import { createAdminClient } from "@/lib/supabase/admin";
import { fetchDeliveryStats } from "@/lib/data/queries";
import { normalizeIndividualOrders } from "@/lib/data/normalize-order";
import {
  estimateDeliveryEta,
  isPastExpectedDate,
} from "@/lib/orders/delivery-eta";
import { canEstimateDeliveryEta, orderPlacementAt } from "@/lib/orders/order-timing";
import { collectKhIdsForSupplierRef } from "@/lib/data/supplier-subiekt-kh";
import { getAppSupplierRefsCached } from "@/lib/data/supplier-refs";
import { zdSearchPlansForOrderWithKhIds } from "@/lib/subiekt/zd-search-for-product";
import {
  getSubiektZdDocumentCached,
  searchSubiektZdCached,
} from "@/lib/subiekt/subiekt-runtime-cache";
import {
  SubiektNetworkError,
  SubiektNotConfiguredError,
  SubiektRequestError,
  SubiektTimeoutError,
} from "@/lib/subiekt/errors";
import { findMatchingZdDocument } from "@/lib/subiekt/match-order-to-zd";
import { extractDocKhIds } from "@/lib/subiekt/zd-document-kh";
import { parseZdFulfillmentDeadline } from "@/lib/subiekt/zd-fulfillment-date";
import { zdContractorRecentDataOd } from "@/lib/subiekt/zd-search-scope";
import { isSubiektReachable } from "@/lib/subiekt/availability";
import { tryAcquireLock, releaseLock } from "@/lib/services/locks";
import type { IndividualOrder, StatsMode } from "@/types/database";
import type { SubiektDocument } from "@/lib/subiekt/types";

export const ZD_ETA_SYNC_LOCK_KEY = "job_zd_eta_sync";

/** Klucz pomocniczy (np. testy); {@link runZdEtaSync} zawsze blokuje globalnie. */
export function zdEtaSyncLockKey(salesPersonId?: string): string {
  return salesPersonId
    ? `${ZD_ETA_SYNC_LOCK_KEY}:sp:${salesPersonId}`
    : ZD_ETA_SYNC_LOCK_KEY;
}

export type ZdFulfillmentMissContext = {
  subiektOffline?: boolean;
  /** Timeout lub limit dokumentów — wynik „brak ZD” może być niepełny. */
  searchIncomplete?: boolean;
};

export type MojeZdEtaRefreshResult = Pick<
  ZdEtaSyncResult,
  "candidates" | "processed" | "skipped" | "reason" | "subiektOffline" | "timedOut"
>;

/** Kiedy sesja przeglądarki może uznać auto-sync za zakończony (bez ponawiania). */
export function shouldMarkMojeZdEtaSessionDone(body: MojeZdEtaRefreshResult): boolean {
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
  return false;
}
export const ZD_ETA_SYNC_TTL_MS = 6 * 60 * 60 * 1000;
/** Krótszy TTL gdy ostatnio nie znaleziono dopasowanego ZD — szybsza ponowna próba. */
export const ZD_ETA_SYNC_MISS_TTL_MS = 2 * 60 * 60 * 1000;

/** Limity globalne (backup po catalog-zd-sync / ręczne force). */
export const ZD_ETA_MAX_DOCS_PER_RUN = 48;
export const ZD_ETA_MAX_DOCS_PER_SUPPLIER = 24;
export const ZD_ETA_INDEX_LIMIT_PER_SUPPLIER = 40;
export const ZD_ETA_MAX_LIVE_SEARCH_PLANS = 2;

/** Limity przy wejściu handlowca na /moje (after, bez crona). */
export const ZD_ETA_MOJE_MAX_ORDERS = 8;
export const ZD_ETA_MOJE_MAX_DOCS = 12;
export const ZD_ETA_MOJE_MAX_DURATION_MS = 15_000;
/** Limit czasu żądania z /moje — nieco powyżej budżetu serwera. */
export const ZD_ETA_MOJE_CLIENT_FETCH_TIMEOUT_MS = 20_000;
export const ZD_ETA_MOJE_INDEX_LIMIT_PER_SUPPLIER = 20;

/** Globalny backup — stronicowanie zamiast ładowania wszystkich wierszy naraz. */
export const ZD_ETA_GLOBAL_ORDER_SCAN_PAGE = 100;
export const ZD_ETA_GLOBAL_ORDER_SCAN_MAX = 500;

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

/** Opóźnione zamówienie kwalifikujące się do dopasowania terminu z ZD (bez TTL). */
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

  const eta = estimateDeliveryEta(placement, stats, order.order_type, statsMode);
  return Boolean(eta && isPastExpectedDate(eta.expectedDate));
}

export function needsZdEtaSync(
  order: IndividualOrder,
  stats: ReturnType<typeof statsBySupplierId>[string] | undefined,
  statsMode: StatsMode,
  nowMs: number,
  force = false
): boolean {
  if (!isZdEtaOverdueCandidate(order, stats, statsMode)) return false;

  if (!order.zd_fulfillment_synced_at) return true;
  if (force) return true;
  const syncedAt = new Date(order.zd_fulfillment_synced_at).getTime();
  if (!Number.isFinite(syncedAt)) return true;
  const ttl =
    order.zd_fulfillment_source === "zd"
      ? ZD_ETA_SYNC_TTL_MS
      : ZD_ETA_SYNC_MISS_TTL_MS;
  return nowMs - syncedAt >= ttl;
}

/**
 * Przy braku dopasowania: backup odświeża synced_at; force czyści nieaktualny termin
 * tylko po pełnym przeszukaniu — nie przy offline / timeout / limicie dokumentów.
 */
export function zdFulfillmentPersistOnMissAction(
  force: boolean | undefined,
  retainExistingZd: boolean,
  ctx: ZdFulfillmentMissContext = {}
): "clear" | "touch" {
  if (retainExistingZd) {
    if (ctx.subiektOffline || ctx.searchIncomplete) return "touch";
    if (force) return "clear";
    return "touch";
  }
  return "clear";
}

/** Czy zachować wcześniej zsynchronizowany termin ZD przy braku nowego dopasowania. */
export function hasPersistedZdFulfillment(
  order: Pick<IndividualOrder, "zd_fulfillment_source" | "zd_fulfillment_deadline">
): boolean {
  return (
    order.zd_fulfillment_source === "zd" &&
    Boolean(order.zd_fulfillment_deadline?.trim())
  );
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
    if (!primaryKhId(supplier)) return false;
    return needsZdEtaSync(
      order,
      statsMap[order.supplier_id!],
      statsMode,
      nowMs,
      options?.force
    );
  });

  candidates.sort((a, b) => {
    const pa = orderPlacementAt(a) ?? "";
    const pb = orderPlacementAt(b) ?? "";
    return pa.localeCompare(pb);
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
 * Opóźnione pozycje bez terminu z ZD — klient /moje uruchamia force sync (live search).
 * Obejmuje też świeże „brak dopasowania” w TTL miss, gdy server after() już nie powtórzy próby.
 */
export function countZdEtaMojeClientSyncTriggers(
  orders: IndividualOrder[],
  statsRows: Awaited<ReturnType<typeof fetchDeliveryStats>>,
  suppliers: SupplierRef[],
  subiektReachable = true
): number {
  if (!subiektReachable) return 0;
  const statsMap = statsBySupplierId(statsRows);
  const supplierById = new Map(suppliers.map((s) => [s.id, s]));
  return orders.filter((order) => {
    if (order.sales_acknowledged_at) return false;
    if (hasPersistedZdFulfillment(order)) return false;
    const supplier = order.supplier_id ? supplierById.get(order.supplier_id) : undefined;
    if (!primaryKhId(supplier)) return false;
    const statsMode = (order.supplier?.stats_mode ?? "LACZNIE") as StatsMode;
    return isZdEtaOverdueCandidate(
      order,
      order.supplier_id ? statsMap[order.supplier_id] : undefined,
      statsMode
    );
  }).length;
}

function supplierKhIds(supplier: SupplierRef | undefined): number[] {
  if (!supplier) return [];
  return collectKhIdsForSupplierRef(supplier);
}

function primaryKhId(supplier: SupplierRef | undefined): number | null {
  return supplierKhIds(supplier)[0] ?? null;
}

function isTimeBudgetExceeded(startedMs: number, maxDurationMs: number): boolean {
  return Date.now() - startedMs >= maxDurationMs;
}

async function loadRecentZdIndexForKhIds(
  khIds: readonly number[],
  limit: number
): Promise<Array<{ dok_id: number; dok_nr_pelny: string | null; dok_data_wyst: string | null }>> {
  const scoped = [...new Set(khIds.map((id) => Math.trunc(id)).filter((id) => id > 0))];
  if (!scoped.length) return [];

  const supabase = createAdminClient();
  const dataOd = zdContractorRecentDataOd();
  const { data, error } = await supabase
    .from("subiekt_zd_index")
    .select("dok_id, dok_nr_pelny, dok_data_wyst")
    .in("subiekt_kh_id", scoped)
    .eq("verified", true)
    .gte("dok_data_wyst", dataOd)
    .order("dok_data_wyst", { ascending: false })
    .order("dok_id", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return data ?? [];
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
  return findMatchingZdDocument(order, sortDocsNewestFirst(scoped));
}

async function fetchZdDocumentSafe(dokId: number): Promise<SubiektDocument | null> {
  try {
    return await getSubiektZdDocumentCached(dokId);
  } catch (e) {
    if (isSubiektOfflineError(e)) throw e;
    return null;
  }
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
  const plans = zdSearchPlansForOrderWithKhIds(
    {
      symbol: order.symbol,
      products: order.products,
      subiekt_tw_id: order.subiekt_tw_id,
    },
    khIds
  ).slice(0, maxPlans);

  const docs: SubiektDocument[] = [];
  const seen = new Set<number>();
  let fetched = 0;

  for (const plan of plans) {
    if (fetched >= docBudget) break;
    const list = await searchSubiektZdCached(plan);
    for (const item of list.data ?? []) {
      if (fetched >= docBudget) break;
      const id = Math.trunc(Number(item.dok_Id));
      if (!Number.isFinite(id) || id <= 0 || seen.has(id) || knownDocIds.has(id)) {
        continue;
      }
      seen.add(id);
      const full = await loadDoc(id);
      if (!full) continue;
      fetched++;
      if (!zdDocumentMatchesSupplierKhIds(full, khIds)) continue;
      docs.push(full);
    }
  }

  const matched = findMatchingZdDocumentForSupplier(order, docs, khIds);
  return { docs, fetched, matched };
}

function sortDocsNewestFirst(docs: SubiektDocument[]): SubiektDocument[] {
  return [...docs].sort((a, b) => {
    const da = (a.dok_DataWyst ?? "").slice(0, 10);
    const db = (b.dok_DataWyst ?? "").slice(0, 10);
    if (da !== db) return db.localeCompare(da);
    return Math.trunc(Number(b.dok_Id)) - Math.trunc(Number(a.dok_Id));
  });
}

async function touchZdFulfillmentSync(orderId: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("individual_orders")
    .update({ zd_fulfillment_synced_at: new Date().toISOString() })
    .eq("id", orderId);

  if (error) throw new Error(error.message);
}

/** Przed wymuszonym sync — czyści znacznik próby bez terminu, żeby UI pokazało oczekiwanie. */
async function clearZdFulfillmentSyncAttempt(orderId: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("individual_orders")
    .update({ zd_fulfillment_synced_at: null })
    .eq("id", orderId);

  if (error) throw new Error(error.message);
}

async function persistZdFulfillment(
  orderId: string,
  input: {
    deadline: string | null;
    dokNr: string | null;
    source: "zd" | null;
  }
): Promise<void> {
  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("individual_orders")
    .update({
      zd_fulfillment_deadline: input.deadline,
      zd_fulfillment_source: input.source,
      zd_fulfillment_dok_nr: input.dokNr,
      zd_fulfillment_synced_at: now,
    })
    .eq("id", orderId);

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
  return runZdEtaSync({
    salesPersonId,
    maxOrders: ZD_ETA_MOJE_MAX_ORDERS,
    maxDocsPerRun: ZD_ETA_MOJE_MAX_DOCS,
    maxDocsPerSupplier: Math.min(12, ZD_ETA_MOJE_MAX_DOCS),
    indexLimitPerSupplier: ZD_ETA_MOJE_INDEX_LIMIT_PER_SUPPLIER,
    maxDurationMs: ZD_ETA_MOJE_MAX_DURATION_MS,
    allowLiveSearch: options?.allowLiveSearch ?? false,
    force: options?.force,
  });
}

/** Globalny backup po nocnym catalog-zd-sync (bez nowego crona). */
export async function runZdEtaSyncGlobalBackup(): Promise<ZdEtaSyncResult> {
  return runZdEtaSync({
    maxDurationMs: 60_000,
    maxOrders: 24,
    allowLiveSearch: false,
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

  const lockKey = ZD_ETA_SYNC_LOCK_KEY;
  const locked = await tryAcquireLock(lockKey, 240, "zd_eta_sync");
  if (!locked) {
    return { ...empty, skipped: true, reason: "lock_held" };
  }

  try {
    const [orders, statsRows, suppliers] = await Promise.all([
      fetchZdEtaSyncOrderPool(options.salesPersonId),
      fetchDeliveryStats(),
      getAppSupplierRefsCached(),
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

    if (options.force) {
      for (const order of candidates) {
        if (!hasPersistedZdFulfillment(order)) {
          await clearZdFulfillmentSyncAttempt(order.id);
        }
      }
    }

    const bySupplier = new Map<string, IndividualOrder[]>();
    for (const order of candidates) {
      const sid = order.supplier_id!;
      const list = bySupplier.get(sid) ?? [];
      list.push(order);
      bySupplier.set(sid, list);
    }

    let processed = 0;
    let updated = 0;
    let cleared = 0;
    let docsFetched = 0;
    let subiektOffline = false;
    let timedOut = false;
    const processedIds = new Set<string>();

    const persistOrderMatch = async (
      order: IndividualOrder,
      matched: SubiektDocument | null,
      orderSearchIncomplete: boolean
    ): Promise<void> => {
      const retainExistingZd = hasPersistedZdFulfillment(order);
      const missAction = zdFulfillmentPersistOnMissAction(options.force, retainExistingZd, {
        subiektOffline,
        searchIncomplete: orderSearchIncomplete,
      });

      if (!matched) {
        if (missAction === "touch") {
          await touchZdFulfillmentSync(order.id);
        } else {
          await persistZdFulfillment(order.id, {
            deadline: null,
            dokNr: null,
            source: null,
          });
          cleared++;
        }
        return;
      }

      const deadline = parseZdFulfillmentDeadline(matched);
      const dokNr = matched.dok_NrPelny?.trim() || `ZD #${matched.dok_Id}`;

      if (!deadline) {
        if (missAction === "touch") {
          await touchZdFulfillmentSync(order.id);
        } else {
          await persistZdFulfillment(order.id, {
            deadline: null,
            dokNr: null,
            source: null,
          });
          cleared++;
        }
        return;
      }

      await persistZdFulfillment(order.id, {
        deadline,
        dokNr,
        source: "zd",
      });
      updated++;
    };

    supplierLoop: for (const [supplierId, supplierOrders] of bySupplier) {
      if (isTimeBudgetExceeded(started, maxDurationMs)) {
        timedOut = true;
        break;
      }
      if (docsFetched >= maxDocsPerRun) break;

      const supplier = supplierById.get(supplierId);
      const khIds = supplierKhIds(supplier);
      if (!khIds.length) continue;

      const indexRows = await loadRecentZdIndexForKhIds(khIds, indexLimitPerSupplier);

      const supplierDocCache = new Map<number, SubiektDocument>();
      let supplierDocsFetched = 0;
      let indexRowCursor = 0;
      const indexDocs: SubiektDocument[] = [];

      const loadDoc = async (dokId: number): Promise<SubiektDocument | null> => {
        const cached = supplierDocCache.get(dokId);
        if (cached) return cached;
        if (docsFetched >= maxDocsPerRun) return null;
        if (supplierDocsFetched >= maxDocsPerSupplier) return null;
        try {
          const doc = await fetchZdDocumentSafe(dokId);
          supplierDocsFetched++;
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

      const loadNextIndexDoc = async (): Promise<SubiektDocument | null> => {
        while (indexRowCursor < indexRows.length) {
          if (isTimeBudgetExceeded(started, maxDurationMs)) return null;
          if (docsFetched >= maxDocsPerRun) return null;
          if (supplierDocsFetched >= maxDocsPerSupplier) return null;
          if (subiektOffline) return null;
          const row = indexRows[indexRowCursor++]!;
          const doc = await loadDoc(Math.trunc(row.dok_id));
          if (subiektOffline) return null;
          if (doc) {
            indexDocs.push(doc);
            return doc;
          }
        }
        return null;
      };

      for (const order of supplierOrders) {
        if (isTimeBudgetExceeded(started, maxDurationMs)) {
          timedOut = true;
          break supplierLoop;
        }
        if (docsFetched >= maxDocsPerRun) break supplierLoop;

        while (
          !subiektOffline &&
          indexRowCursor < indexRows.length &&
          docsFetched < maxDocsPerRun &&
          supplierDocsFetched < maxDocsPerSupplier &&
          !isTimeBudgetExceeded(started, maxDurationMs)
        ) {
          await loadNextIndexDoc();
        }

        let matched = findMatchingZdDocumentForSupplier(order, indexDocs, khIds);

        if (subiektOffline) break supplierLoop;

        if (
          !matched &&
          allowLiveSearch &&
          docsFetched < maxDocsPerRun &&
          supplierDocsFetched < maxDocsPerSupplier &&
          !isTimeBudgetExceeded(started, maxDurationMs)
        ) {
          try {
            const { docs: liveDocs, matched: liveMatched } =
              await liveSearchZdDocsForOrder(
                order,
                khIds,
                ZD_ETA_MAX_LIVE_SEARCH_PLANS,
                maxDocsPerRun - docsFetched,
                maxDocsPerSupplier - supplierDocsFetched,
                new Set(supplierDocCache.keys()),
                loadDoc
              );
            for (const doc of liveDocs) {
              if (!supplierDocCache.has(Math.trunc(Number(doc.dok_Id)))) {
                indexDocs.push(doc);
              }
            }
            matched =
              liveMatched ??
              findMatchingZdDocumentForSupplier(
                order,
                [...indexDocs, ...liveDocs],
                khIds
              );
          } catch (e) {
            if (isSubiektOfflineError(e)) {
              subiektOffline = true;
              break supplierLoop;
            }
            throw e;
          }
        }

        const orderSearchIncomplete =
          subiektOffline ||
          timedOut ||
          (!matched &&
            (docsFetched >= maxDocsPerRun ||
              supplierDocsFetched >= maxDocsPerSupplier ||
              isTimeBudgetExceeded(started, maxDurationMs)));

        await persistOrderMatch(order, matched, orderSearchIncomplete);
        processedIds.add(order.id);
        processed++;
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
