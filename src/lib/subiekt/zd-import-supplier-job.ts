import { createAdminClient } from "@/lib/supabase/admin";
import { isSubiektReachable } from "@/lib/subiekt/availability";
import { defaultZdSearchDataOd, getSubiektDocumentCached } from "@/lib/subiekt/subiekt-runtime-cache";
import { upsertSubiektProduct, bumpProductSupplierLinkBy } from "@/lib/data/product-catalog";
import type { SubiektDocumentLine } from "@/lib/subiekt/types";
import type { SubiektDocument } from "@/lib/subiekt/types";

export type ZdImportSupplierJobState = {
  status: "idle" | "running" | "done" | "failed";
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
  const dataOd = defaultZdSearchDataOd(input.monthsBack ?? 18);
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

export async function stopZdImportForSupplier(
  supplierId: string
): Promise<ZdImportSupplierJobState | null> {
  const current = await readZdImportSupplierJobState(supplierId);
  if (!current) return null;
  const next: ZdImportSupplierJobState = {
    ...current,
    status: "idle",
    lastUpdatedAt: nowIso(),
  };
  await writeState(next);
  return next;
}

function lineTowId(line: SubiektDocumentLine): number | null {
  const raw = line.ob_TowId;
  if (raw == null) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.trunc(n);
}

// (stare dopasowanie po kh_Id w detalu dokumentu usunięte —
// teraz import działa wyłącznie na dok_Id z tabeli subiekt_zd_index)

export async function tickZdImportForSupplier(input: {
  supplierId: string;
  maxDocs?: number;
}): Promise<ZdImportSupplierJobState> {
  const current = await readZdImportSupplierJobState(input.supplierId);
  if (!current) throw new Error("Brak stanu joba — uruchom Start.");
  if (current.status !== "running") return current;

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

  try {
    const supabase = createAdminClient();

    if (current.indexTotalDocs == null) {
      const { count, error } = await supabase
        .from("subiekt_zd_index")
        .select("dok_id", { count: "exact", head: true })
        .eq("supplier_id", current.supplierId)
        .eq("verified", true)
        .gte("dok_data_wyst", current.dataOd);
      if (error) throw new Error(error.message);
      const primed: ZdImportSupplierJobState = {
        ...current,
        indexTotalDocs: count ?? 0,
        lastUpdatedAt: nowIso(),
      };
      await writeState(primed);
      return primed;
    }

    const from = current.indexOffset;
    const to = current.indexOffset + Math.max(1, maxDocs) - 1;
    const { data: indexRows, error: idxErr } = await supabase
      .from("subiekt_zd_index")
      .select("dok_id, dok_nr_pelny, dok_data_wyst")
      .eq("supplier_id", current.supplierId)
      .eq("verified", true)
      .gte("dok_data_wyst", current.dataOd)
      .order("dok_data_wyst", { ascending: false })
      .order("dok_id", { ascending: false })
      .range(from, to);
    if (idxErr) throw new Error(idxErr.message);

    const slice = (indexRows ?? []).map((r) => ({
      dokId: Number((r as any).dok_id),
      nr: (r as any).dok_nr_pelny != null ? String((r as any).dok_nr_pelny) : null,
    })).filter((r) => Number.isFinite(r.dokId));

    if (!slice.length) {
      const done: ZdImportSupplierJobState = {
        ...current,
        status: "done",
        lastUpdatedAt: nowIso(),
      };
      await writeState(done);
      return done;
    }

    const towAgg = new Map<number, { symbol: string | null; name: string | null; count: number }>();
    let processedDocs = 0;
    let processedLines = 0;
    let lastDocNumber: string | null = null;

    for (const brief of slice) {
      const docId = brief.dokId;
      const doc = await getSubiektDocumentCached(docId);
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

    // upsert produkty + linki (agregacja po tw_Id)
    const seenBefore = current.uniqueProductsSeen;
    let linksUpserted = 0;
    for (const [twId, meta] of towAgg.entries()) {
      await upsertSubiektProduct({
        subiektTwId: twId,
        symbol: meta.symbol,
        name: meta.name,
        seenAt: nowIso(),
      });
      await bumpProductSupplierLinkBy({
        subiektTwId: twId,
        supplierId: current.supplierId,
        delta: meta.count,
        lastSource: "zd_import",
        lastActionAt: nowIso(),
      });
      linksUpserted += 1;
    }

    const nextOffset = current.indexOffset + slice.length;
    const isDone = current.indexTotalDocs != null && nextOffset >= current.indexTotalDocs;

    const next: ZdImportSupplierJobState = {
      ...current,
      status: isDone ? "done" : "running",
      indexOffset: isDone ? current.indexOffset : nextOffset,
      processedDocs: current.processedDocs + processedDocs,
      processedLines: current.processedLines + processedLines,
      uniqueProductsSeen: seenBefore + towAgg.size,
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
}

