import { createAdminClient } from "@/lib/supabase/admin";
import type { AppSupplierRef } from "@/lib/subiekt/match-supplier";

export type ProductCatalogSuggestion = {
  subiektTwId: number;
  symbol: string | null;
  name: string | null;
  plu: string | null;
  /** Ostatnio używany dostawca dla tego produktu w naszej bazie. */
  topSupplier: AppSupplierRef & { lastActionAt: string | null } | null;
};

function buildIlikePattern(q: string): string {
  return `%${q.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
}

function normalizeQuery(q: string): string {
  return q.trim();
}

/** Szuka produktów w naszej bazie (subiekt_products) po symbolu/nazwie/PLU.
 *  Dla każdego produktu zwraca ostatnio używanego dostawcę (po last_action_at). */
export async function searchProductCatalogSuggestions(
  query: string,
  limit = 12
): Promise<ProductCatalogSuggestion[]> {
  const q = normalizeQuery(query);
  if (!q) return [];

  const supabase = createAdminClient();
  const pattern = buildIlikePattern(q);

  const { data: rows, error } = await supabase
    .from("subiekt_products")
    .select(
      `
      subiekt_tw_id,
      symbol,
      name,
      plu,
      product_supplier_links!left(
        supplier_id,
        order_count,
        last_action_at,
        last_source,
        suppliers!inner(id, name)
      )
    `
    )
    .or(`symbol.ilike.${pattern},name.ilike.${pattern},plu.ilike.${pattern}`)
    .order("last_seen_at", { ascending: false })
    .limit(Math.max(1, Math.min(100, limit)));

  if (error) throw new Error(error.message);

  const result: ProductCatalogSuggestion[] = [];
  for (const raw of rows ?? []) {
    const subiektTwId = Number(raw.subiekt_tw_id);
    if (!Number.isFinite(subiektTwId) || subiektTwId <= 0) continue;

    const links = (raw.product_supplier_links ?? []) as unknown as Array<{
      supplier_id: string;
      order_count: number;
      last_action_at: string | null;
      last_source: string | null;
      suppliers: { id: string; name: string } | Array<{ id: string; name: string }> | null;
    }>;

    const scoreSource = (s: string | null) =>
      s === "procurement_verification" ? 3 : s === "order_history" ? 2 : s === "zd_import" ? 1 : 0;

    const topLink = links
      .map((l) => {
        const sup = l.suppliers;
        const supplier = Array.isArray(sup) ? sup[0] : sup;
        return { ...l, supplier };
      })
      .filter((l) => l.supplier != null)
      .sort((a, b) => {
        const c = (b.order_count ?? 0) - (a.order_count ?? 0);
        if (c !== 0) return c;
        const sc = scoreSource(b.last_source) - scoreSource(a.last_source);
        if (sc !== 0) return sc;
        return (
          new Date(b.last_action_at ?? 0).getTime() -
          new Date(a.last_action_at ?? 0).getTime()
        );
      })[0];

    result.push({
      subiektTwId,
      symbol: String(raw.symbol ?? ""),
      name: String(raw.name ?? ""),
      plu: String(raw.plu ?? ""),
      topSupplier: topLink
        ? {
            id: topLink.supplier!.id,
            name: topLink.supplier!.name,
            lastActionAt: topLink.last_action_at,
          }
        : null,
    });
  }

  return result;
}
