import { createAdminClient } from "@/lib/supabase/admin";
import { upsertSubiektProduct, bumpProductSupplierLinkBy } from "@/lib/data/product-catalog";
import { getSubiektZdDocumentCached } from "@/lib/subiekt/subiekt-runtime-cache";
import { SubiektRequestError } from "@/lib/subiekt/errors";
import { extractDocKhIds } from "@/lib/subiekt/zd-document-kh";
import type { SubiektDocumentLine } from "@/lib/subiekt/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export type PendingZdImportScope = {
  supplierId: string;
  dataOd: string;
};

export type PendingZdIndexRow = {
  dok_id: number;
  dok_nr_pelny: string | null;
  dok_data_wyst: string | null;
};

function nowIso(): string {
  return new Date().toISOString();
}

export function lineTowId(line: SubiektDocumentLine): number | null {
  const raw = line.ob_TowId;
  if (raw == null) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.trunc(n);
}

export type ZdCatalogImportResult = {
  processedLines: number;
  uniqueProducts: number;
  linksUpserted: number;
  skipped?: boolean;
  skipReason?: "not_found" | "supplier_mismatch" | "index_mismatch";
};

const emptyImportResult = (): Pick<
  ZdCatalogImportResult,
  "processedLines" | "uniqueProducts" | "linksUpserted"
> => ({
  processedLines: 0,
  uniqueProducts: 0,
  linksUpserted: 0,
});

/** Importuje linie jednego ZD do katalogu produktów (produkt + link u dostawcy). */
export async function importZdDocumentToCatalog(
  dokId: number,
  supplierId: string
): Promise<ZdCatalogImportResult> {
  const supabase = createAdminClient();
  const { data: indexRow, error: indexErr } = await supabase
    .from("subiekt_zd_index")
    .select("supplier_id, subiekt_kh_id")
    .eq("dok_id", Math.trunc(dokId))
    .maybeSingle();
  if (indexErr) throw new Error(indexErr.message);

  if (!indexRow?.supplier_id || String(indexRow.supplier_id) !== supplierId) {
    await noteZdCatalogImportSkipped(
      dokId,
      "Indeks wskazuje innego dostawcę — pominięto import."
    );
    return { ...emptyImportResult(), skipped: true, skipReason: "supplier_mismatch" };
  }

  let doc;
  try {
    doc = await getSubiektZdDocumentCached(dokId);
  } catch (e) {
    if (e instanceof SubiektRequestError && e.status === 404) {
      await noteZdCatalogImportSkipped(dokId, "Brak dokumentu w Subiekcie (404) — pominięto.");
      return {
        ...emptyImportResult(),
        skipped: true,
        skipReason: "not_found",
      };
    }
    throw e;
  }

  const khIds = extractDocKhIds(doc);
  const indexedKh =
    indexRow.subiekt_kh_id != null ? Math.trunc(Number(indexRow.subiekt_kh_id)) : null;
  if (indexedKh != null && !khIds.includes(indexedKh)) {
    await noteZdCatalogImportSkipped(
      dokId,
      `Kontrahent dokumentu nie zgadza się z indeksem (kh ${indexedKh}) — pominięto.`
    );
    return { ...emptyImportResult(), skipped: true, skipReason: "index_mismatch" };
  }

  const { data: supplierRow, error: supplierErr } = await supabase
    .from("suppliers")
    .select("subiekt_kh_id")
    .eq("id", supplierId)
    .maybeSingle();
  if (supplierErr) throw new Error(supplierErr.message);

  const supplierKh =
    supplierRow?.subiekt_kh_id != null
      ? Math.trunc(Number(supplierRow.subiekt_kh_id))
      : null;
  if (supplierKh != null && !khIds.includes(supplierKh)) {
    await noteZdCatalogImportSkipped(
      dokId,
      `Dokument nie należy do dostawcy (kh ${supplierKh}) — pominięto.`
    );
    return { ...emptyImportResult(), skipped: true, skipReason: "supplier_mismatch" };
  }
  const towAgg = new Map<number, { symbol: string | null; name: string | null; count: number }>();
  let processedLines = 0;

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

  const seenAt = nowIso();
  let linksUpserted = 0;
  for (const [twId, meta] of towAgg.entries()) {
    await upsertSubiektProduct({
      subiektTwId: twId,
      symbol: meta.symbol,
      name: meta.name,
      seenAt,
    });
    await bumpProductSupplierLinkBy({
      subiektTwId: twId,
      supplierId,
      delta: meta.count,
      lastSource: "zd_import",
      lastActionAt: seenAt,
    });
    linksUpserted += 1;
  }

  return {
    processedLines,
    uniqueProducts: towAgg.size,
    linksUpserted,
  };
}

async function noteZdCatalogImportSkipped(dokId: number, note: string): Promise<void> {
  const supabase = createAdminClient();
  const at = nowIso();
  const { error } = await supabase
    .from("subiekt_zd_index")
    .update({
      catalog_imported_at: at,
      note,
      updated_at: at,
    })
    .eq("dok_id", Math.trunc(dokId));
  if (error) throw new Error(error.message);
}

export async function markZdCatalogImported(dokIds: number[]): Promise<void> {
  if (!dokIds.length) return;
  const supabase = createAdminClient();
  const at = nowIso();
  const { error } = await supabase
    .from("subiekt_zd_index")
    .update({ catalog_imported_at: at, updated_at: at })
    .in("dok_id", dokIds.map((id) => Math.trunc(id)));
  if (error) throw new Error(error.message);
}

/** Blokada importu per dostawca — współdzielona przez autopilot i import ręczny. */
export function zdImportSupplierLockKey(supplierId: string): string {
  return `job_zd_import_supplier_${supplierId}_lock`;
}

/**
 * Importuje ZD i od razu oznacza w indeksie (atomowo per dokument).
 * Przy błędzie w batchu wcześniejsze dokumenty nie wracają do kolejki pending.
 */
export async function importAndMarkZdDocumentToCatalog(
  dokId: number,
  supplierId: string
): Promise<ZdCatalogImportResult> {
  const result = await importZdDocumentToCatalog(dokId, supplierId);
  if (!result.skipped) {
    await markZdCatalogImported([dokId]);
  }
  return result;
}

/** Zweryfikowany ZD z dostawcą, jeszcze niezaimportowany do katalogu. */
export function pendingZdImportCountQuery(
  supabase: SupabaseClient,
  scope: PendingZdImportScope
) {
  return supabase
    .from("subiekt_zd_index")
    .select("dok_id", { count: "exact", head: true })
    .eq("supplier_id", scope.supplierId)
    .eq("verified", true)
    .is("catalog_imported_at", null)
    .gte("dok_data_wyst", scope.dataOd);
}

/** Kolejka pending — zawsze od początku (bez offsetu), żeby po imporcie nie pomijać dokumentów. */
export function pendingZdImportRowsQuery(
  supabase: SupabaseClient,
  scope: PendingZdImportScope
) {
  return supabase
    .from("subiekt_zd_index")
    .select("dok_id, dok_nr_pelny, dok_data_wyst")
    .eq("supplier_id", scope.supplierId)
    .eq("verified", true)
    .is("catalog_imported_at", null)
    .gte("dok_data_wyst", scope.dataOd)
    .order("dok_data_wyst", { ascending: false })
    .order("dok_id", { ascending: false });
}

export async function countPendingZdImports(scope: PendingZdImportScope): Promise<number> {
  const supabase = createAdminClient();
  const { count, error } = await pendingZdImportCountQuery(supabase, scope);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

/** Czyści flagę importu — pozwala ponownie zaimportować ZD po cleanup linków. */
export async function resetZdCatalogImportFlagsForSupplier(
  supplierId: string,
  dataOd?: string
): Promise<number> {
  const supabase = createAdminClient();
  const at = nowIso();
  let query = supabase
    .from("subiekt_zd_index")
    .update({ catalog_imported_at: null, updated_at: at })
    .eq("supplier_id", supplierId)
    .eq("verified", true);
  if (dataOd) {
    query = query.gte("dok_data_wyst", dataOd);
  }
  const { data, error } = await query.select("dok_id");
  if (error) throw new Error(error.message);
  return data?.length ?? 0;
}
