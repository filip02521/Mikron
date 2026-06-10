import { createAdminClient } from "@/lib/supabase/admin";
import { isSubiektReachable } from "@/lib/subiekt/availability";
import { defaultZdSearchDataOd } from "@/lib/subiekt/subiekt-runtime-cache";
import {
  countPendingZdImports,
  importAndMarkZdDocumentToCatalog,
  pendingZdImportRowsQuery,
  zdImportSupplierLockKey,
  type PendingZdIndexRow,
} from "@/lib/subiekt/zd-catalog-import";
import { tryAcquireLock, releaseLock } from "@/lib/services/locks";

export type ZdImportSupplierJobState = {
  status: "idle" | "running" | "paused" | "done" | "failed";
  supplierId: string;
  supplierName: string;
  subiektKhId: number;
  // cursor
  dataOd: string;
  indexOffset: number;
  indexTotalDocs: number | null;
  batchDocs: number;
  // metrics
  processedDocs: number;
  processedLines: number;
  uniqueProductsSeen: number;
  linksUpserted: number;
  lastDocNumber: string | null;
  lastUpdatedAt: string;
  lastError: string | null;
};

function jobKey(supplierId: string): string {
  return `job_zd_import_supplier_${supplierId}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

export async function readZdImportSupplierJobState(
  supplierId: string
): Promise<ZdImportSupplierJobState | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", jobKey(supplierId))
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.value || typeof data.value !== "object") return null;
  return data.value as ZdImportSupplierJobState;
}

async function writeState(state: ZdImportSupplierJobState): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("app_settings").upsert({
    key: jobKey(state.supplierId),
    value: state,
  });
  if (error) throw new Error(error.message);
}

export async function startZdImportForSupplier(input: {
  supplierId: string;
  supplierName: string;
  subiektKhId: number;
  monthsBack?: number;
  batchDocs?: number;
}): Promise<ZdImportSupplierJobState> {
  const dataOd = defaultZdSearchDataOd(input.monthsBack ?? 60);
  const state: ZdImportSupplierJobState = {
    status: "running",
    supplierId: input.supplierId,
    supplierName: input.supplierName,
    subiektKhId: Math.trunc(input.subiektKhId),
    dataOd,
    indexOffset: 0,
    indexTotalDocs: null,
    batchDocs: input.batchDocs ?? 3,
    processedDocs: 0,
    processedLines: 0,
    uniqueProductsSeen: 0,
    linksUpserted: 0,
    lastDocNumber: null,
    lastUpdatedAt: nowIso(),
    lastError: null,
  };
  await writeState(state);
  return state;
}

export function isZdImportSupplierJobResumable(
  state: ZdImportSupplierJobState | null
): boolean {
  if (!state) return false;
  if (state.status === "done" || state.status === "idle") return false;
  return true;
}

export async function stopZdImportForSupplier(
  supplierId: string
): Promise<ZdImportSupplierJobState | null> {
  const current = await readZdImportSupplierJobState(supplierId);
  if (!current) return null;
  if (current.status === "done") return current;
  const next: ZdImportSupplierJobState = {
    ...current,
    status: "paused",
    lastUpdatedAt: nowIso(),
  };
  await writeState(next);
  return next;
}

export async function continueZdImportForSupplier(
  supplierId: string
): Promise<ZdImportSupplierJobState | null> {
  const current = await readZdImportSupplierJobState(supplierId);
  if (!current || !isZdImportSupplierJobResumable(current)) return current;
  const next: ZdImportSupplierJobState = {
    ...current,
    status: "running",
    lastError: null,
    lastUpdatedAt: nowIso(),
  };
  await writeState(next);
  return next;
}

export async function clearZdImportSupplierJobState(supplierId: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("app_settings").delete().eq("key", jobKey(supplierId));
  if (error) throw new Error(error.message);
}

export async function tickZdImportForSupplier(input: {
  supplierId: string;
  maxDocs?: number;
}): Promise<ZdImportSupplierJobState> {
  const current = await readZdImportSupplierJobState(input.supplierId);
  if (!current) throw new Error("Brak stanu joba — uruchom Start.");
  if (current.status !== "running") return current;

  const lockKey = zdImportSupplierLockKey(input.supplierId);
  const acquired = await tryAcquireLock(lockKey, 60, "zd-import-supplier");
  if (!acquired) return current;

  try {
    if (!(await isSubiektReachable())) {
      const next: ZdImportSupplierJobState = {
        ...current,
        status: "failed",
        lastError: "Subiekt offline / poza LAN",
        lastUpdatedAt: nowIso(),
      };
      await writeState(next);
      return next;
    }

    const maxDocs = input.maxDocs ?? current.batchDocs ?? 3;
    const scope = { supplierId: current.supplierId, dataOd: current.dataOd };

    try {
      const supabase = createAdminClient();

      if (current.indexTotalDocs == null) {
        const pending = await countPendingZdImports(scope);
        const primed: ZdImportSupplierJobState = {
          ...current,
          indexTotalDocs: pending,
          indexOffset: 0,
          lastUpdatedAt: nowIso(),
        };
        await writeState(primed);
        return primed;
      }

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
        const done: ZdImportSupplierJobState = {
          ...current,
          status: "done",
          indexOffset: current.processedDocs,
          lastUpdatedAt: nowIso(),
        };
        await writeState(done);
        return done;
      }

      let processedDocs = 0;
      let processedLines = 0;
      let lastDocNumber: string | null = null;
      let uniqueProducts = 0;
      let linksUpserted = 0;

      for (const brief of validSlice) {
        const imported = await importAndMarkZdDocumentToCatalog(brief.dokId, current.supplierId);
        processedDocs += 1;
        processedLines += imported.processedLines;
        uniqueProducts += imported.uniqueProducts;
        linksUpserted += imported.linksUpserted;
        lastDocNumber = brief.nr ?? lastDocNumber;
      }

      const processedTotal = current.processedDocs + processedDocs;
      const pendingLeft = await countPendingZdImports(scope);
      const isDone = pendingLeft === 0;

      const next: ZdImportSupplierJobState = {
        ...current,
        status: isDone ? "done" : "running",
        indexOffset: processedTotal,
        indexTotalDocs: current.indexTotalDocs,
        processedDocs: processedTotal,
        processedLines: current.processedLines + processedLines,
        uniqueProductsSeen: current.uniqueProductsSeen + uniqueProducts,
        linksUpserted: current.linksUpserted + linksUpserted,
        lastDocNumber,
        lastUpdatedAt: nowIso(),
        lastError: null,
      };
      await writeState(next);
      return next;
    } catch (e) {
      const next: ZdImportSupplierJobState = {
        ...current,
        status: "failed",
        lastError: e instanceof Error ? e.message : "import failed",
        lastUpdatedAt: nowIso(),
      };
      await writeState(next);
      return next;
    }
  } finally {
    await releaseLock(lockKey);
  }
}
