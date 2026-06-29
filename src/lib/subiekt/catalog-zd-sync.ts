import { createAdminClient } from "@/lib/supabase/admin";
import { isSubiektReachable } from "@/lib/subiekt/availability";
import { autoAssignMissingSuppliersFromCatalog } from "@/lib/services/auto-assign-suppliers";
import { SubiektRequestError } from "@/lib/subiekt/errors";
import {
  getSubiektZdDocumentCached,
  searchSubiektZdCached,
} from "@/lib/subiekt/subiekt-runtime-cache";
import {
  importAndMarkZdDocumentToCatalog,
} from "@/lib/subiekt/zd-catalog-import";
import { warsawNowParts } from "@/lib/time/warsaw";
import { resolveKhLabelForZdDocument } from "@/lib/subiekt/kontrahent-from-document";
import { parseZdFulfillmentDeadline } from "@/lib/subiekt/zd-fulfillment-date";
import type { SubiektDocument } from "@/lib/subiekt/types";

export const CATALOG_ZD_SYNC_STATE_KEY = "catalog_zd_sync_state";
export const CATALOG_SYNC_DAYS_BACK = 90;
export const CATALOG_SYNC_INDEX_PAGE_SIZE = 25;
export const CATALOG_SYNC_INDEX_BATCH_DOCS = 10;
export const CATALOG_SYNC_IMPORT_BATCH_DOCS = 15;

/** Budżet jednego wywołania HTTP crona nocnego (~14 min). Route musi mieć maxDuration ≥ 15 min (on-prem). */
export const CATALOG_ZD_SYNC_CRON_BUDGET_MS = 14 * 60 * 1000;
export const CATALOG_ZD_SYNC_CRON_ROUTE_MAX_SEC = 900;

/** Opis harmonogramu w panelu admina (sloty w install-cron.sh / install-cron.ps1). */
export const CATALOG_ZD_SYNC_CRON_SCHEDULE_LABEL =
  "codziennie 2:00–4:40 co 20 min (Warszawa)";

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeNumeric(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.trunc(n);
}

function extractDocKhIds(doc: SubiektDocument): number[] {
  const ids: number[] = [];
  ids.push(
    ...[
      normalizeNumeric((doc as SubiektDocument & { dok_OdbiorcaId?: unknown }).dok_OdbiorcaId),
      normalizeNumeric((doc as SubiektDocument & { dok_PlatnikId?: unknown }).dok_PlatnikId),
      normalizeNumeric((doc as SubiektDocument & { kh_Id?: unknown }).kh_Id),
      normalizeNumeric((doc as SubiektDocument & { dok_KontrahentId?: unknown }).dok_KontrahentId),
      normalizeNumeric((doc as SubiektDocument & { dok_KhId?: unknown }).dok_KhId),
      normalizeNumeric((doc as SubiektDocument & { dok_DostawcaId?: unknown }).dok_DostawcaId),
    ].filter((n): n is number => n != null)
  );
  for (const k of [
    (doc as SubiektDocument & { kh__Kontrahent_Platnik?: { kh_Id?: unknown } }).kh__Kontrahent_Platnik,
    (doc as SubiektDocument & { kh__Kontrahent_Odbiorca?: { kh_Id?: unknown } }).kh__Kontrahent_Odbiorca,
  ]) {
    const n = normalizeNumeric(k?.kh_Id);
    if (n != null) ids.push(n);
  }
  return [...new Set(ids)].filter((n) => Number.isFinite(n) && n > 0);
}

export function catalogSyncDataOd(daysBack = CATALOG_SYNC_DAYS_BACK): string {
  const d = new Date();
  d.setDate(d.getDate() - daysBack);
  return d.toISOString().slice(0, 10);
}

/** Okno nocnej synchronizacji katalogu: 1:00–4:59 w Warszawie (dowolny dzień tygodnia). */
export function isWarsawCatalogSyncWindow(date = new Date()): boolean {
  const { hour } = warsawNowParts(date);
  return hour >= 1 && hour <= 4;
}

export type CatalogZdSyncPhase = "index" | "import";

export type CatalogZdSyncState = {
  status: "idle" | "running" | "done" | "failed";
  runId: string;
  phase: CatalogZdSyncPhase;
  dataOd: string;
  indexPage: number;
  indexPageSize: number;
  indexTotalPages: number | null;
  indexComplete: boolean;
  importComplete: boolean;
  indexProcessed: number;
  indexMapped: number;
  indexUnmapped: number;
  indexUnverifiable: number;
  importProcessedDocs: number;
  importProducts: number;
  importLinks: number;
  importPending: number | null;
  autoAssignUpdated: number;
  startedAt: string;
  finishedAt: string | null;
  lastDocNumber: string | null;
  lastError: string | null;
  lastUpdatedAt: string;
};

export type CatalogZdSyncRunResult = {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  subiektOffline?: boolean;
  state: CatalogZdSyncState;
  timedOut: boolean;
};

function freshState(runId: string): CatalogZdSyncState {
  const at = nowIso();
  return {
    status: "running",
    runId,
    phase: "index",
    dataOd: catalogSyncDataOd(),
    indexPage: 1,
    indexPageSize: CATALOG_SYNC_INDEX_PAGE_SIZE,
    indexTotalPages: null,
    indexComplete: false,
    importComplete: false,
    indexProcessed: 0,
    indexMapped: 0,
    indexUnmapped: 0,
    indexUnverifiable: 0,
    importProcessedDocs: 0,
    importProducts: 0,
    importLinks: 0,
    importPending: null,
    autoAssignUpdated: 0,
    startedAt: at,
    finishedAt: null,
    lastDocNumber: null,
    lastError: null,
    lastUpdatedAt: at,
  };
}

export async function readCatalogZdSyncState(): Promise<CatalogZdSyncState | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", CATALOG_ZD_SYNC_STATE_KEY)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.value || typeof data.value !== "object") return null;
  return data.value as CatalogZdSyncState;
}

async function writeCatalogZdSyncState(state: CatalogZdSyncState): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("app_settings").upsert({
    key: CATALOG_ZD_SYNC_STATE_KEY,
    value: state,
  });
  if (error) throw new Error(error.message);
}

async function loadSupplierByKh(): Promise<Map<number, string>> {
  const { loadSupplierIdByKhMap } = await import("@/lib/data/supplier-subiekt-kh");
  return loadSupplierIdByKhMap();
}

async function countPendingImports(dataOd: string): Promise<number> {
  const supabase = createAdminClient();
  const { count, error } = await supabase
    .from("subiekt_zd_index")
    .select("dok_id", { count: "exact", head: true })
    .eq("verified", true)
    .not("supplier_id", "is", null)
    .is("catalog_imported_at", null)
    .gte("dok_data_wyst", dataOd);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function indexBatch(
  state: CatalogZdSyncState,
  supplierByKh: Map<number, string>,
  maxDocs: number
): Promise<CatalogZdSyncState> {
  const list = await searchSubiektZdCached({
    dataOd: state.dataOd,
    page: state.indexPage,
    pageSize: state.indexPageSize,
    includeBlocked: true,
  });

  const totalPages = list.pagination?.totalPages ?? null;
  const docs = list.data ?? [];

  if (!docs.length) {
    return {
      ...state,
      indexTotalPages: totalPages,
      indexComplete: true,
      phase: "import",
      lastUpdatedAt: nowIso(),
    };
  }

  const supabase = createAdminClient();
  const slice = docs.slice(0, maxDocs);
  let indexMapped = 0;
  let indexUnmapped = 0;
  let indexUnverifiable = 0;
  let lastDocNumber: string | null = null;

  for (const brief of slice) {
    const docId = Number((brief as { dok_Id?: unknown }).dok_Id);
    if (!Number.isFinite(docId)) continue;
    let doc: SubiektDocument;
    try {
      doc = await getSubiektZdDocumentCached(docId);
    } catch (e) {
      if (e instanceof SubiektRequestError && e.status === 404) continue;
      throw e;
    }
    lastDocNumber = doc.dok_NrPelny ?? null;
    const khIds = extractDocKhIds(doc);
    const matchedKhId = khIds.find((id) => supplierByKh.has(id)) ?? null;
    const supplierId = matchedKhId != null ? supplierByKh.get(matchedKhId) ?? null : null;
    const verified = khIds.length > 0;
    const storedKhId = matchedKhId ?? khIds[0] ?? null;
    const khLabel = resolveKhLabelForZdDocument(doc, storedKhId, khIds);

    if (!verified) indexUnverifiable += 1;
    else if (supplierId) indexMapped += 1;
    else indexUnmapped += 1;

    const { error } = await supabase.from("subiekt_zd_index").upsert(
      {
        dok_id: Math.trunc(Number(doc.dok_Id)),
        dok_nr_pelny: doc.dok_NrPelny ?? null,
        dok_data_wyst: doc.dok_DataWyst ?? null,
        subiekt_kh_id: storedKhId,
        subiekt_kh_label: khLabel,
        supplier_id: supplierId,
        verified,
        dok_status: doc.dok_Status ?? null,
        dok_termin_realizacji: parseZdFulfillmentDeadline(doc),
        processed_at: nowIso(),
        updated_at: nowIso(),
      },
      { onConflict: "dok_id", ignoreDuplicates: false }
    );
    if (error) throw new Error(error.message);
  }

  const nextPage = state.indexPage + 1;
  const indexComplete = totalPages != null && nextPage > totalPages;

  return {
    ...state,
    indexTotalPages: totalPages,
    indexPage: indexComplete ? state.indexPage : nextPage,
    indexComplete,
    phase: indexComplete ? "import" : "index",
    indexProcessed: state.indexProcessed + slice.length,
    indexMapped: state.indexMapped + indexMapped,
    indexUnmapped: state.indexUnmapped + indexUnmapped,
    indexUnverifiable: state.indexUnverifiable + indexUnverifiable,
    lastDocNumber,
    lastUpdatedAt: nowIso(),
    lastError: null,
  };
}

async function importBatch(
  state: CatalogZdSyncState,
  maxDocs: number
): Promise<CatalogZdSyncState> {
  const supabase = createAdminClient();
  const { data: rows, error } = await supabase
    .from("subiekt_zd_index")
    .select("dok_id, dok_nr_pelny, supplier_id")
    .eq("verified", true)
    .not("supplier_id", "is", null)
    .is("catalog_imported_at", null)
    .gte("dok_data_wyst", state.dataOd)
    .order("dok_data_wyst", { ascending: false })
    .order("dok_id", { ascending: false })
    .limit(maxDocs);
  if (error) throw new Error(error.message);

  const slice = (rows ?? []) as Array<{
    dok_id: number;
    dok_nr_pelny: string | null;
    supplier_id: string;
  }>;

  if (!slice.length) {
    const pending = await countPendingImports(state.dataOd);
    return {
      ...state,
      importComplete: true,
      importPending: pending,
      lastUpdatedAt: nowIso(),
    };
  }

  let importProducts = 0;
  let importLinks = 0;
  let lastDocNumber: string | null = null;

  for (const row of slice) {
    const dokId = Math.trunc(Number(row.dok_id));
    const supplierId = String(row.supplier_id);
    if (!Number.isFinite(dokId) || !supplierId) continue;
    const result = await importAndMarkZdDocumentToCatalog(dokId, supplierId);
    importProducts += result.uniqueProducts;
    importLinks += result.linksUpserted;
    lastDocNumber = row.dok_nr_pelny ?? lastDocNumber;
  }

  const pending = await countPendingImports(state.dataOd);
  const importComplete = pending === 0;

  return {
    ...state,
    importProcessedDocs: state.importProcessedDocs + slice.length,
    importProducts: state.importProducts + importProducts,
    importLinks: state.importLinks + importLinks,
    importComplete,
    importPending: pending,
    lastDocNumber,
    lastUpdatedAt: nowIso(),
    lastError: null,
  };
}

/**
 * Wybór stanu startowego — `force` pomija „już dziś”, ale NIE zeruje postępu.
 * Pełny restart tylko przy `reset: true` lub gdy poprzedni przebieg zakończył się
 * sukcesem (status "done" z ukończonym indeksem i importem).
 *
 * Jeśli poprzedni przebieg nie ukończył indeksu (timeout, błąd), kontynuujemy
 * od zapisanej strony — inaczej przy dużej liczbie ZD cron nigdy nie dojdzie
 * do późniejszych stron i dokumenty tam nigdy nie dostaną supplier_id.
 */
export function resolveCatalogZdSyncStartState(
  existing: CatalogZdSyncState | null,
  runId: string,
  options?: { force?: boolean; reset?: boolean }
): CatalogZdSyncState {
  if (options?.reset || !existing) {
    return freshState(runId);
  }
  if (existing.runId !== runId) {
    if (existing.status === "done" && existing.indexComplete && existing.importComplete) {
      return freshState(runId);
    }
    return {
      ...existing,
      runId,
      status: "running",
      lastError: null,
      lastUpdatedAt: nowIso(),
    };
  }
  if (existing.status === "running") {
    return existing;
  }
  return {
    ...existing,
    status: "running",
    lastError: null,
    lastUpdatedAt: nowIso(),
  };
}

export async function runCatalogZdSync(options?: {
  force?: boolean;
  /** Pełny restart indeksu+importu (np. test po zakończonym przebiegu). */
  reset?: boolean;
  maxDurationMs?: number;
  indexBatchDocs?: number;
  importBatchDocs?: number;
}): Promise<CatalogZdSyncRunResult> {
  const runId = warsawNowParts().dateKey;
  const maxDurationMs = options?.maxDurationMs ?? 4 * 60 * 1000;
  const indexBatchDocs = options?.indexBatchDocs ?? CATALOG_SYNC_INDEX_BATCH_DOCS;
  const importBatchDocs = options?.importBatchDocs ?? CATALOG_SYNC_IMPORT_BATCH_DOCS;
  const started = Date.now();

  if (!(await isSubiektReachable())) {
    const prev = (await readCatalogZdSyncState()) ?? freshState(runId);
    const failed: CatalogZdSyncState = {
      ...prev,
      status: "failed",
      lastError: "Subiekt offline / poza LAN",
      lastUpdatedAt: nowIso(),
    };
    await writeCatalogZdSyncState(failed);
    return { ok: false, subiektOffline: true, state: failed, timedOut: false };
  }

  const prev = await readCatalogZdSyncState();
  if (
    !options?.force &&
    !options?.reset &&
    prev?.status === "done" &&
    prev.runId === runId
  ) {
    return { ok: true, skipped: true, reason: "already_ran_today", state: prev, timedOut: false };
  }

  let state = resolveCatalogZdSyncStartState(prev, runId, options);

  const supplierByKh = await loadSupplierByKh();

  try {
    while (Date.now() - started < maxDurationMs) {
      if (state.phase === "index" && !state.indexComplete) {
        state = await indexBatch(state, supplierByKh, indexBatchDocs);
      } else if (!state.importComplete) {
        state = await importBatch(state, importBatchDocs);
      } else {
        break;
      }

      await writeCatalogZdSyncState(state);

      if (state.indexComplete && state.importComplete) break;
    }

    const timedOut = Date.now() - started >= maxDurationMs;
    const allDone = state.indexComplete && state.importComplete;

    if (allDone) {
      const auto = await autoAssignMissingSuppliersFromCatalog({ limit: 120 });
      state = {
        ...state,
        autoAssignUpdated: auto.updated,
        status: "done",
        finishedAt: nowIso(),
        lastUpdatedAt: nowIso(),
      };
    } else if (timedOut) {
      state = {
        ...state,
        status: "running",
        lastUpdatedAt: nowIso(),
      };
    }

    await writeCatalogZdSyncState(state);

    return {
      ok: allDone && !state.lastError,
      state,
      timedOut,
      skipped: false,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "catalog sync failed";
    state = {
      ...state,
      status: "failed",
      lastError: message,
      lastUpdatedAt: nowIso(),
    };
    await writeCatalogZdSyncState(state);
    return { ok: false, state, timedOut: false };
  }
}
