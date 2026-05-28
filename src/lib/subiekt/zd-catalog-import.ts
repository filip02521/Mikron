import { createAdminClient } from "@/lib/supabase/admin";
import { upsertSubiektProduct, bumpProductSupplierLinkBy } from "@/lib/data/product-catalog";
import { getSubiektDocumentCached } from "@/lib/subiekt/subiekt-runtime-cache";
import type { SubiektDocument, SubiektDocumentLine } from "@/lib/subiekt/types";

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
};

/** Importuje linie jednego ZD do katalogu produktów (produkt + link u dostawcy). */
export async function importZdDocumentToCatalog(
  dokId: number,
  supplierId: string
): Promise<ZdCatalogImportResult> {
  const doc = await getSubiektDocumentCached(dokId);
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
