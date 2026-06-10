import { createAdminClient } from "@/lib/supabase/admin";
import { upsertSubiektProduct, bumpProductSupplierLinkBy } from "@/lib/data/product-catalog";
import { getSubiektZdDocumentCached } from "@/lib/subiekt/subiekt-runtime-cache";
import { SubiektRequestError } from "@/lib/subiekt/errors";
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
  skipReason?: "not_found";
};

/** Importuje linie jednego ZD do katalogu produktów (produkt + link u dostawcy). */
export async function importZdDocumentToCatalog(
  dokId: number,
  supplierId: string
): Promise<ZdCatalogImportResult> {
  let doc;
  try {
    doc = await getSubiektZdDocumentCached(dokId);
  } catch (e) {
    if (e instanceof SubiektRequestError && e.status === 404) {
      await noteZdCatalogImportSkipped(dokId, "Brak dokumentu w Subiekcie (404) — pominięto.");
      return {
        processedLines: 0,
        uniqueProducts: 0,
        linksUpserted: 0,
        skipped: true,
        skipReason: "not_found",
      };
    }
    throw e;
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
export async function resetZdCatalogImportFlagsForSupplier(supplierId: string): Promise<number> {
  const supabase = createAdminClient();
  const at = nowIso();
  const { data, error } = await supabase
    .from("subiekt_zd_index")
    .update({ catalog_imported_at: null, updated_at: at })
    .eq("supplier_id", supplierId)
    .eq("verified", true)
    .select("dok_id");
  if (error) throw new Error(error.message);
  return data?.length ?? 0;
}
