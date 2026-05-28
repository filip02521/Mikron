import { createAdminClient } from "@/lib/supabase/admin";
import { isSubiektReachable } from "@/lib/subiekt/availability";
import { defaultZdSearchDataOd, getSubiektDocumentCached, searchSubiektZdCached } from "@/lib/subiekt/subiekt-runtime-cache";
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
  page: number;
  pageSize: number;
  totalPages: number | null;
  // metrics
  processedDocs: number;
  skippedDocsWrongSupplier: number;
  unverifiableDocs: number;
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
  pageSize?: number;
}): Promise<ZdImportSupplierJobState> {
  const dataOd = defaultZdSearchDataOd(input.monthsBack ?? 18);
  const state: ZdImportSupplierJobState = {
    status: "running",
    supplierId: input.supplierId,
    supplierName: input.supplierName,
    subiektKhId: Math.trunc(input.subiektKhId),
    dataOd,
    page: 1,
    pageSize: input.pageSize ?? 25,
    totalPages: null,
    processedDocs: 0,
    skippedDocsWrongSupplier: 0,
    unverifiableDocs: 0,
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

function normalizeNumeric(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.trunc(n);
}

/**
 * W Subiekt API pola kontrahenta bywają różne zależnie od wersji/widoku.
 * Zwraca:
 * - true/false jeśli potrafimy jednoznacznie porównać do target kh_Id
 * - null jeśli w dokumencie nie ma żadnego sensownego id kontrahenta (nie weryfikujemy)
 */
function docMatchesKhId(doc: SubiektDocument, targetKhId: number): boolean | null {
  const target = Math.trunc(targetKhId);
  const ids: number[] = [];

  // Najczęstsze pola (zgodne z typami)
  ids.push(
    ...[
      normalizeNumeric((doc as any).dok_PlatnikId),
      normalizeNumeric((doc as any).dok_OdbiorcaId),
      normalizeNumeric((doc as any).kh_Id),
      normalizeNumeric((doc as any).dok_KontrahentId),
      normalizeNumeric((doc as any).dok_KhId),
      normalizeNumeric((doc as any).dok_DostawcaId),
    ].filter((n): n is number => n != null)
  );

  // Zagnieżdżone kontrahenty
  for (const k of [(doc as any).kh__Kontrahent_Platnik, (doc as any).kh__Kontrahent_Odbiorca]) {
    if (k?.kh_Id != null) {
      const n = normalizeNumeric(k.kh_Id);
      if (n != null) ids.push(n);
    }
  }

  // Heurystyka: jeśli API zwraca inne pola z id kontrahenta, zbierz je.
  // Nie bierzemy wszystkiego — tylko liczby przy kluczach wyglądających jak kontrahent.
  for (const [key, value] of Object.entries(doc as Record<string, unknown>)) {
    if (!/(kh|kontrah|platnik|odbiorca|dostawc)/i.test(key)) continue;
    const n = normalizeNumeric(value);
    if (n != null) ids.push(n);
  }

  const unique = [...new Set(ids)].filter((n) => Number.isFinite(n) && n > 0);
  if (!unique.length) return null;
  return unique.includes(target);
}

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

  const maxDocs = input.maxDocs ?? 3;

  try {
    const list = await searchSubiektZdCached({
      khId: current.subiektKhId,
      dataOd: current.dataOd,
      page: current.page,
      pageSize: current.pageSize,
      includeBlocked: true,
    });

    const totalPages = list.pagination?.totalPages ?? null;
    const docs = list.data ?? [];

    if (!docs.length) {
      const done: ZdImportSupplierJobState = {
        ...current,
        status: "done",
        totalPages,
        lastUpdatedAt: nowIso(),
      };
      await writeState(done);
      return done;
    }

    const slice = docs.slice(0, maxDocs);
    const towAgg = new Map<number, { symbol: string | null; name: string | null; count: number }>();
    let processedDocs = 0;
    let skippedDocsWrongSupplier = 0;
    let unverifiableDocs = 0;
    let processedLines = 0;
    let lastDocNumber: string | null = null;

    for (const brief of slice) {
      const docId = Number(brief.dok_Id);
      if (!Number.isFinite(docId)) continue;
      const doc = await getSubiektDocumentCached(docId);
      lastDocNumber = doc.dok_NrPelny ?? null;

      // Twarda walidacja: API listy ZD potrafi zwrócić dokumenty spoza khId.
      const match = docMatchesKhId(doc as unknown as SubiektDocument, current.subiektKhId);
      if (match === false) {
        skippedDocsWrongSupplier += 1;
        continue;
      }
      if (match == null) {
        unverifiableDocs += 1;
      }

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

    // jeśli przetworzyliśmy tylko część strony, zostajemy na tej stronie,
    // ale w praktyce w kolejnych tickach będziemy i tak iść stronami — prostsze:
    const nextPage = current.page + 1;
    const isDone = totalPages != null && nextPage > totalPages;

    const next: ZdImportSupplierJobState = {
      ...current,
      status: isDone ? "done" : "running",
      totalPages,
      page: isDone ? current.page : nextPage,
      processedDocs: current.processedDocs + processedDocs,
      skippedDocsWrongSupplier: current.skippedDocsWrongSupplier + skippedDocsWrongSupplier,
      unverifiableDocs: current.unverifiableDocs + unverifiableDocs,
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

