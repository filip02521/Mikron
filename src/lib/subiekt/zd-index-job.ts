import { createAdminClient } from "@/lib/supabase/admin";
import { isSubiektReachable } from "@/lib/subiekt/availability";
import { SubiektRequestError } from "@/lib/subiekt/errors";
import { defaultZdSearchDataOd, getSubiektZdDocumentCached, searchSubiektZdCached } from "@/lib/subiekt/subiekt-runtime-cache";
import { resolveKhLabelForZdDocument } from "@/lib/subiekt/kontrahent-from-document";
import { extractDocKhIds } from "@/lib/subiekt/zd-document-kh";
import { parseZdFulfillmentDeadline } from "@/lib/subiekt/zd-fulfillment-date";
import { tryAcquireLock, releaseLock } from "@/lib/services/locks";
import type { SubiektDocument } from "@/lib/subiekt/types";

export type ZdIndexJobState = {
  status: "idle" | "running" | "paused" | "done" | "failed";
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
const LOCK_KEY = "job_zd_index_all_lock";

function nowIso(): string {
  return new Date().toISOString();
}

/** Duży indeks (np. wieloletnia historia z Ivoclar) — 1 dokument na tick, mniejsze po 3. */
function chooseIndexMaxDocs(totalPages: number | null, pageSize: number): number {
  if (totalPages != null && totalPages * pageSize > 5000) return 1;
  return 3;
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
    dataOd: defaultZdSearchDataOd(options?.monthsBack ?? 60),
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

export function isZdIndexJobResumable(state: ZdIndexJobState | null): boolean {
  if (!state) return false;
  if (state.status === "done" || state.status === "idle") return false;
  return true;
}

export async function stopZdIndexJob(): Promise<ZdIndexJobState | null> {
  const current = await readZdIndexJobState();
  if (!current) return null;
  if (current.status === "done") return current;
  const next: ZdIndexJobState = { ...current, status: "paused", lastUpdatedAt: nowIso() };
  await writeState(next);
  return next;
}

export async function continueZdIndexJob(): Promise<ZdIndexJobState | null> {
  const current = await readZdIndexJobState();
  if (!current || !isZdIndexJobResumable(current)) return current;
  const next: ZdIndexJobState = {
    ...current,
    status: "running",
    lastError: null,
    lastUpdatedAt: nowIso(),
  };
  await writeState(next);
  return next;
}

export async function tickZdIndexJob(options?: { maxDocs?: number }): Promise<ZdIndexJobState> {
  const acquired = await tryAcquireLock(LOCK_KEY, 60, "zd-index");
  if (!acquired) {
    const current = await readZdIndexJobState();
    if (current) return current;
    throw new Error("Brak stanu joba — uruchom Start.");
  }

  try {
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

    try {
      const list = await searchSubiektZdCached({
        dataOd: current.dataOd,
        page: current.page,
        pageSize: current.pageSize,
        includeBlocked: true,
      });

      const totalPages = list.pagination?.totalPages ?? null;
      const maxDocs =
        options?.maxDocs ?? chooseIndexMaxDocs(totalPages, current.pageSize);
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
            dok_status: doc.dok_Status ?? null,
            dok_termin_realizacji: parseZdFulfillmentDeadline(doc),
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
  } finally {
    await releaseLock(LOCK_KEY);
  }
}

