import { createAdminClient } from "@/lib/supabase/admin";
import { isSubiektReachable } from "@/lib/subiekt/availability";
import { getSubiektDocumentCached } from "@/lib/subiekt/subiekt-runtime-cache";
import { bumpProductSupplierLinkBy, upsertSubiektProduct } from "@/lib/data/product-catalog";
import type { SubiektDocumentLine } from "@/lib/subiekt/types";
import { tryAcquireLock, releaseLock } from "@/lib/services/locks";

export type ZdImportAllSuppliersJobState = {
  status: "idle" | "running" | "done" | "failed";
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

function lineTowId(line: SubiektDocumentLine): number | null {
  const raw = line.ob_TowId;
  if (raw == null) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.trunc(n);
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
    .map((s) => String((s as any).id))
    .filter(Boolean);

  const state: ZdImportAllSuppliersJobState = {
    status: "running",
    dataOd: options.dataOd,
    supplierIds,
    supplierIndex: 0,
    supplierId: supplierIds[0] ?? null,
    supplierName: (suppliersRaw?.[0] as any)?.name ?? null,
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

export async function stopZdImportAllSuppliersJob(): Promise<ZdImportAllSuppliersJobState | null> {
  const current = await readZdImportAllSuppliersJobState();
  if (!current) return null;
  const next: ZdImportAllSuppliersJobState = { ...current, status: "idle", lastUpdatedAt: nowIso() };
  await writeState(next);
  return next;
}

async function primeSupplierTotals(state: ZdImportAllSuppliersJobState): Promise<ZdImportAllSuppliersJobState> {
  if (!state.supplierId) return state;
  const supabase = createAdminClient();
  const { count, error } = await supabase
    .from("subiekt_zd_index")
    .select("dok_id", { count: "exact", head: true })
    .eq("supplier_id", state.supplierId)
    .eq("verified", true)
    .gte("dok_data_wyst", state.dataOd);
  if (error) throw new Error(error.message);

  const { data: supplierRow, error: sErr } = await supabase
    .from("suppliers")
    .select("name")
    .eq("id", state.supplierId)
    .maybeSingle();
  if (sErr) throw new Error(sErr.message);

  return {
    ...state,
    supplierName: supplierRow?.name ?? state.supplierName,
    indexTotalDocs: count ?? 0,
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

    // jeśli ten dostawca nie ma dokumentów — przejdź dalej
    if (state.indexTotalDocs === 0) {
      const next = await advanceSupplier(state);
      await writeState(next);
      return next;
    }

    const supabase = createAdminClient();
    const maxDocs = options?.maxDocs ?? state.batchDocs ?? 3;
    const from = state.indexOffset;
    const to = state.indexOffset + Math.max(1, maxDocs) - 1;

    const { data: indexRows, error: idxErr } = await supabase
      .from("subiekt_zd_index")
      .select("dok_id, dok_nr_pelny, dok_data_wyst")
      .eq("supplier_id", state.supplierId)
      .eq("verified", true)
      .gte("dok_data_wyst", state.dataOd)
      .order("dok_data_wyst", { ascending: false })
      .order("dok_id", { ascending: false })
      .range(from, to);
    if (idxErr) throw new Error(idxErr.message);

    const slice = (indexRows ?? [])
      .map((r) => ({ dokId: Number((r as any).dok_id), nr: (r as any).dok_nr_pelny != null ? String((r as any).dok_nr_pelny) : null }))
      .filter((r) => Number.isFinite(r.dokId));

    if (!slice.length) {
      // nic więcej dla tego dostawcy — przejdź dalej
      const next = await advanceSupplier(state);
      await writeState(next);
      return next;
    }

    const towAgg = new Map<number, { symbol: string | null; name: string | null; count: number }>();
    let processedDocs = 0;
    let processedLines = 0;
    let lastDocNumber: string | null = null;
    for (const brief of slice) {
      const doc = await getSubiektDocumentCached(brief.dokId);
      lastDocNumber = doc.dok_NrPelny ?? brief.nr ?? null;
      processedDocs += 1;
      for (const line of doc.dok_Pozycja ?? []) {
        const twId = lineTowId(line);
        if (!twId) continue;
        processedLines += 1;
        const prev = towAgg.get(twId);
        if (!prev) {
          towAgg.set(twId, {
            symbol: typeof line.tw_Symbol === "string" ? (line.tw_Symbol.trim() || null) : null,
            name: typeof line.tw_Nazwa === "string" ? (line.tw_Nazwa.trim() || null) : null,
            count: 1,
          });
        } else {
          prev.count += 1;
        }
      }
    }

    let linksUpserted = 0;
    for (const [twId, meta] of towAgg.entries()) {
      await upsertSubiektProduct({ subiektTwId: twId, symbol: meta.symbol, name: meta.name, seenAt: nowIso() });
      await bumpProductSupplierLinkBy({ subiektTwId: twId, supplierId: state.supplierId, delta: meta.count, lastSource: "zd_import", lastActionAt: nowIso() });
      linksUpserted += 1;
    }

    const nextOffset = state.indexOffset + slice.length;
    const supplierDone = nextOffset >= (state.indexTotalDocs ?? 0);
    const nextState: ZdImportAllSuppliersJobState = {
      ...state,
      indexOffset: supplierDone ? state.indexOffset : nextOffset,
      processedDocs: state.processedDocs + processedDocs,
      processedLines: state.processedLines + processedLines,
      linksUpserted: state.linksUpserted + linksUpserted,
      lastDocNumber,
      lastUpdatedAt: nowIso(),
      lastError: null,
    };

    const finalState = supplierDone ? await advanceSupplier(nextState) : nextState;
    await writeState(finalState);
    return finalState;
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

