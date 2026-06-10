import { createAdminClient } from "@/lib/supabase/admin";
import { isSubiektReachable } from "@/lib/subiekt/availability";
import {
  countPendingZdImports,
  importAndMarkZdDocumentToCatalog,
  pendingZdImportRowsQuery,
  zdImportSupplierLockKey,
  type PendingZdIndexRow,
} from "@/lib/subiekt/zd-catalog-import";
import { tryAcquireLock, releaseLock } from "@/lib/services/locks";

export type ZdImportAllSuppliersJobState = {
  status: "idle" | "running" | "paused" | "done" | "failed";
  dataOd: string;
  // supplier cursor
  supplierIds: string[];
  supplierIndex: number;
  supplierId: string | null;
  supplierName: string | null;
  // doc cursor for current supplier
  indexOffset: number;
  indexTotalDocs: number | null;
  batchDocs: number;
  // metrics
  processedSuppliers: number;
  processedDocs: number;
  processedLines: number;
  linksUpserted: number;
  lastDocNumber: string | null;
  lastUpdatedAt: string;
  lastError: string | null;
};

const JOB_KEY = "job_zd_import_all_suppliers";
const LOCK_KEY = "job_zd_import_all_suppliers_lock";

function nowIso(): string {
  return new Date().toISOString();
}

async function writeState(state: ZdImportAllSuppliersJobState): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("app_settings").upsert({ key: JOB_KEY, value: state });
  if (error) throw new Error(error.message);
}

export async function readZdImportAllSuppliersJobState(): Promise<ZdImportAllSuppliersJobState | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", JOB_KEY)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.value || typeof data.value !== "object") return null;
  return data.value as ZdImportAllSuppliersJobState;
}

export async function startZdImportAllSuppliersJob(options: {
  dataOd: string;
  batchDocs?: number;
}): Promise<ZdImportAllSuppliersJobState> {
  const supabase = createAdminClient();
  const { data: suppliersRaw, error } = await supabase
    .from("suppliers")
    .select("id, name, subiekt_kh_id")
    .not("subiekt_kh_id", "is", null)
    .order("name");
  if (error) throw new Error(error.message);

  const supplierIds = (suppliersRaw ?? [])
    .map((s) => String((s as { id: unknown }).id))
    .filter(Boolean);

  const state: ZdImportAllSuppliersJobState = {
    status: "running",
    dataOd: options.dataOd,
    supplierIds,
    supplierIndex: 0,
    supplierId: supplierIds[0] ?? null,
    supplierName: (suppliersRaw?.[0] as { name?: string } | undefined)?.name ?? null,
    indexOffset: 0,
    indexTotalDocs: null,
    batchDocs: options.batchDocs ?? 3,
    processedSuppliers: 0,
    processedDocs: 0,
    processedLines: 0,
    linksUpserted: 0,
    lastDocNumber: null,
    lastUpdatedAt: nowIso(),
    lastError: null,
  };
  await writeState(state);
  return state;
}

export function isZdImportAllSuppliersJobResumable(
  state: ZdImportAllSuppliersJobState | null
): boolean {
  if (!state) return false;
  if (state.status === "done") return false;
  if (state.status === "idle") return false;
  return Boolean(state.supplierIds?.length);
}

export async function stopZdImportAllSuppliersJob(): Promise<ZdImportAllSuppliersJobState | null> {
  const current = await readZdImportAllSuppliersJobState();
  if (!current) return null;
  if (current.status === "done") return current;
  const next: ZdImportAllSuppliersJobState = {
    ...current,
    status: "paused",
    lastUpdatedAt: nowIso(),
  };
  await writeState(next);
  return next;
}

/** Wznawia autopilot od zapisanego dostawcy (po Stop lub błędzie). */
export async function continueZdImportAllSuppliersJob(): Promise<ZdImportAllSuppliersJobState | null> {
  const current = await readZdImportAllSuppliersJobState();
  if (!current || !isZdImportAllSuppliersJobResumable(current)) return current;
  const next: ZdImportAllSuppliersJobState = {
    ...current,
    status: "running",
    lastError: null,
    lastUpdatedAt: nowIso(),
  };
  await writeState(next);
  return next;
}

async function primeSupplierTotals(state: ZdImportAllSuppliersJobState): Promise<ZdImportAllSuppliersJobState> {
  if (!state.supplierId) return state;
  const supabase = createAdminClient();
  const pending = await countPendingZdImports({
    supplierId: state.supplierId,
    dataOd: state.dataOd,
  });

  const { data: supplierRow, error: sErr } = await supabase
    .from("suppliers")
    .select("name")
    .eq("id", state.supplierId)
    .maybeSingle();
  if (sErr) throw new Error(sErr.message);

  return {
    ...state,
    supplierName: supplierRow?.name ?? state.supplierName,
    indexTotalDocs: pending,
    indexOffset: 0,
    lastUpdatedAt: nowIso(),
  };
}

async function advanceSupplier(state: ZdImportAllSuppliersJobState): Promise<ZdImportAllSuppliersJobState> {
  const nextIdx = state.supplierIndex + 1;
  const nextId = state.supplierIds[nextIdx] ?? null;
  const next: ZdImportAllSuppliersJobState = {
    ...state,
    supplierIndex: nextIdx,
    supplierId: nextId,
    supplierName: null,
    indexOffset: 0,
    indexTotalDocs: null,
    processedSuppliers: state.processedSuppliers + 1,
    lastUpdatedAt: nowIso(),
  };
  if (!nextId) {
    return { ...next, status: "done" };
  }
  return primeSupplierTotals(next);
}

export async function tickZdImportAllSuppliersJob(options?: { maxDocs?: number }): Promise<ZdImportAllSuppliersJobState> {
  const acquired = await tryAcquireLock(LOCK_KEY, 60, "zd-import-all-suppliers");
  if (!acquired) {
    const current = await readZdImportAllSuppliersJobState();
    return current ?? {
      status: "idle",
      dataOd: "",
      supplierIds: [],
      supplierIndex: 0,
      supplierId: null,
      supplierName: null,
      indexOffset: 0,
      indexTotalDocs: null,
      batchDocs: 3,
      processedSuppliers: 0,
      processedDocs: 0,
      processedLines: 0,
      linksUpserted: 0,
      lastDocNumber: null,
      lastUpdatedAt: nowIso(),
      lastError: "lock_busy",
    };
  }

  try {
    const current = await readZdImportAllSuppliersJobState();
    if (!current) throw new Error("Brak stanu joba — uruchom Start.");
    if (current.status !== "running") return current;

    if (!(await isSubiektReachable())) {
      const next = { ...current, status: "failed" as const, lastError: "Subiekt offline / poza LAN", lastUpdatedAt: nowIso() };
      await writeState(next);
      return next;
    }

    let state = current;
    if (!state.supplierId) {
      const done = { ...state, status: "done" as const, lastUpdatedAt: nowIso() };
      await writeState(done);
      return done;
    }

    if (state.indexTotalDocs == null) {
      state = await primeSupplierTotals(state);
      await writeState(state);
      return state;
    }

    if (state.indexTotalDocs === 0) {
      const next = await advanceSupplier(state);
      await writeState(next);
      return next;
    }

    const supabase = createAdminClient();
    const maxDocs = options?.maxDocs ?? state.batchDocs ?? 3;
    const scope = { supplierId: state.supplierId, dataOd: state.dataOd };

    const supplierLockKey = zdImportSupplierLockKey(state.supplierId);
    const supplierLock = await tryAcquireLock(supplierLockKey, 60, "zd-import-all-suppliers");
    if (!supplierLock) return state;

    try {
      const { data: indexRows, error: idxErr } = await pendingZdImportRowsQuery(
        supabase,
        scope
      ).limit(Math.max(1, maxDocs));
      if (idxErr) throw new Error(idxErr.message);

      const slice = (indexRows ?? []) as PendingZdIndexRow[];
      const validSlice = slice
        .map((r) => ({
          dokId: Number(r.dok_id),
          nr: r.dok_nr_pelny != null ? String(r.dok_nr_pelny) : null,
        }))
        .filter((r) => Number.isFinite(r.dokId));

      if (!validSlice.length) {
        const next = await advanceSupplier(state);
        await writeState(next);
        return next;
      }

      let processedDocs = 0;
      let processedLines = 0;
      let linksUpserted = 0;
      let lastDocNumber: string | null = null;

      for (const brief of validSlice) {
        const imported = await importAndMarkZdDocumentToCatalog(brief.dokId, state.supplierId);
        processedDocs += 1;
        processedLines += imported.processedLines;
        linksUpserted += imported.linksUpserted;
        lastDocNumber = brief.nr ?? lastDocNumber;
      }

      const supplierDocsDone = (await countPendingZdImports(scope)) === 0;
      const supplierProcessedDocs = state.indexOffset + processedDocs;

      const nextState: ZdImportAllSuppliersJobState = {
        ...state,
        indexOffset: supplierProcessedDocs,
        processedDocs: state.processedDocs + processedDocs,
        processedLines: state.processedLines + processedLines,
        linksUpserted: state.linksUpserted + linksUpserted,
        lastDocNumber,
        lastUpdatedAt: nowIso(),
        lastError: null,
      };

      const finalState = supplierDocsDone ? await advanceSupplier(nextState) : nextState;
      await writeState(finalState);
      return finalState;
    } finally {
      await releaseLock(supplierLockKey);
    }
  } catch (e) {
    const current = await readZdImportAllSuppliersJobState();
    const next: ZdImportAllSuppliersJobState = current
      ? { ...current, status: "failed", lastError: e instanceof Error ? e.message : "import failed", lastUpdatedAt: nowIso() }
      : {
          status: "failed",
          dataOd: "",
          supplierIds: [],
          supplierIndex: 0,
          supplierId: null,
          supplierName: null,
          indexOffset: 0,
          indexTotalDocs: null,
          batchDocs: 3,
          processedSuppliers: 0,
          processedDocs: 0,
          processedLines: 0,
          linksUpserted: 0,
          lastDocNumber: null,
          lastUpdatedAt: nowIso(),
          lastError: e instanceof Error ? e.message : "import failed",
        };
    if (current) await writeState(next);
    return next;
  } finally {
    await releaseLock(LOCK_KEY);
  }
}
