import { createAdminClient } from "@/lib/supabase/admin";
import { isSubiektReachable } from "@/lib/subiekt/availability";
import { SubiektRequestError } from "@/lib/subiekt/errors";
import { defaultZdSearchDataOd, getSubiektZdDocumentCached, searchSubiektZdCached } from "@/lib/subiekt/subiekt-runtime-cache";
import { resolveKhLabelForZdDocument } from "@/lib/subiekt/kontrahent-from-document";
import type { SubiektDocument } from "@/lib/subiekt/types";

export type ZdIndexJobState = {
  status: "idle" | "running" | "done" | "failed";
  dataOd: string;
  page: number;
  pageSize: number;
  totalPages: number | null;
  processed: number;
  mapped: number;
  unmapped: number;
  unverifiable: number;
  lastDocNumber: string | null;
  lastUpdatedAt: string;
  lastError: string | null;
};

const JOB_KEY = "job_zd_index_all";

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
      normalizeNumeric((doc as any).dok_OdbiorcaId),
      normalizeNumeric((doc as any).dok_PlatnikId),
      normalizeNumeric((doc as any).kh_Id),
      normalizeNumeric((doc as any).dok_KontrahentId),
      normalizeNumeric((doc as any).dok_KhId),
      normalizeNumeric((doc as any).dok_DostawcaId),
    ].filter((n): n is number => n != null)
  );
  for (const k of [(doc as any).kh__Kontrahent_Platnik, (doc as any).kh__Kontrahent_Odbiorca]) {
    const n = normalizeNumeric(k?.kh_Id);
    if (n != null) ids.push(n);
  }
  return [...new Set(ids)].filter((n) => Number.isFinite(n) && n > 0);
}

async function writeState(state: ZdIndexJobState): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("app_settings").upsert({ key: JOB_KEY, value: state });
  if (error) throw new Error(error.message);
}

export async function readZdIndexJobState(): Promise<ZdIndexJobState | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", JOB_KEY)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.value || typeof data.value !== "object") return null;
  return data.value as ZdIndexJobState;
}

export async function startZdIndexJob(options?: { monthsBack?: number; pageSize?: number }) {
  const state: ZdIndexJobState = {
    status: "running",
    dataOd: defaultZdSearchDataOd(options?.monthsBack ?? 18),
    page: 1,
    pageSize: options?.pageSize ?? 25,
    totalPages: null,
    processed: 0,
    mapped: 0,
    unmapped: 0,
    unverifiable: 0,
    lastDocNumber: null,
    lastUpdatedAt: nowIso(),
    lastError: null,
  };
  await writeState(state);
  return state;
}

export async function stopZdIndexJob(): Promise<ZdIndexJobState | null> {
  const current = await readZdIndexJobState();
  if (!current) return null;
  const next: ZdIndexJobState = { ...current, status: "idle", lastUpdatedAt: nowIso() };
  await writeState(next);
  return next;
}

export async function tickZdIndexJob(options?: { maxDocs?: number }): Promise<ZdIndexJobState> {
  const current = await readZdIndexJobState();
  if (!current) throw new Error("Brak stanu joba — uruchom Start.");
  if (current.status !== "running") return current;

  if (!(await isSubiektReachable())) {
    const next: ZdIndexJobState = {
      ...current,
      status: "failed",
      lastError: "Subiekt offline / poza LAN",
      lastUpdatedAt: nowIso(),
    };
    await writeState(next);
    return next;
  }

  const maxDocs = options?.maxDocs ?? 3;

  try {
    const list = await searchSubiektZdCached({
      dataOd: current.dataOd,
      page: current.page,
      pageSize: current.pageSize,
      includeBlocked: true,
    });

    const totalPages = list.pagination?.totalPages ?? null;
    const docs = list.data ?? [];
    if (!docs.length) {
      const done: ZdIndexJobState = {
        ...current,
        status: "done",
        totalPages,
        lastUpdatedAt: nowIso(),
      };
      await writeState(done);
      return done;
    }

    const supabase = createAdminClient();
    const { loadSupplierIdByKhMap } = await import("@/lib/data/supplier-subiekt-kh");
    const supplierByKh = await loadSupplierIdByKhMap();

    const slice = docs.slice(0, maxDocs);
    let processed = 0;
    let mapped = 0;
    let unmapped = 0;
    let unverifiable = 0;
    let lastDocNumber: string | null = null;

    for (const brief of slice) {
      const docId = Number((brief as any).dok_Id);
      if (!Number.isFinite(docId)) continue;
      let doc: SubiektDocument;
      try {
        doc = await getSubiektZdDocumentCached(docId);
      } catch (e) {
        if (e instanceof SubiektRequestError && e.status === 404) continue;
        throw e;
      }
      lastDocNumber = doc.dok_NrPelny ?? null;
      const khIds = extractDocKhIds(doc as SubiektDocument);
      // W dokumencie mogą być 2+ identyfikatory kontrahenta (płatnik/odbiorca/kontrahent).
      // Najpierw wybierz taki, który odpowiada któremuś dostawcy w aplikacji.
      const matchedKhId = khIds.find((id) => supplierByKh.has(id)) ?? null;
      const supplierId = matchedKhId != null ? supplierByKh.get(matchedKhId) ?? null : null;
      const verified = khIds.length > 0;
      const storedKhId = matchedKhId ?? khIds[0] ?? null;
      const khLabel = resolveKhLabelForZdDocument(doc as SubiektDocument, storedKhId, khIds);

      if (!verified) unverifiable += 1;
      else if (supplierId) mapped += 1;
      else unmapped += 1;

      const { error } = await supabase.from("subiekt_zd_index").upsert(
        {
          dok_id: Math.trunc(Number(doc.dok_Id)),
          dok_nr_pelny: doc.dok_NrPelny ?? null,
          dok_data_wyst: doc.dok_DataWyst ?? null,
          subiekt_kh_id: storedKhId,
          subiekt_kh_label: khLabel,
          supplier_id: supplierId,
          verified,
          processed_at: nowIso(),
          updated_at: nowIso(),
        },
        { onConflict: "dok_id" }
      );
      if (error) throw new Error(error.message);
      processed += 1;
    }

    const nextPage = current.page + 1;
    const isDone = totalPages != null && nextPage > totalPages;

    const next: ZdIndexJobState = {
      ...current,
      status: isDone ? "done" : "running",
      totalPages,
      page: isDone ? current.page : nextPage,
      processed: current.processed + processed,
      mapped: current.mapped + mapped,
      unmapped: current.unmapped + unmapped,
      unverifiable: current.unverifiable + unverifiable,
      lastDocNumber,
      lastUpdatedAt: nowIso(),
      lastError: null,
    };
    await writeState(next);
    return next;
  } catch (e) {
    const next: ZdIndexJobState = {
      ...current,
      status: "failed",
      lastError: e instanceof Error ? e.message : "index failed",
      lastUpdatedAt: nowIso(),
    };
    await writeState(next);
    return next;
  }
}

