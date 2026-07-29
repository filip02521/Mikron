/** Stan i stałe UI sync katalogu ZD — bezpieczne dla klienta (bez I/O Subiekta). */

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
