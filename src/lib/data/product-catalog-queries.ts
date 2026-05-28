import { createAdminClient } from "@/lib/supabase/admin";

export type ProductCatalogRow = {
  subiektTwId: number;
  symbol: string | null;
  name: string | null;
  plu: string | null;
  note: string;
  lastSeenAt: string;
  totalOrders: number;
  topSupplier: { id: string; name: string; orderCount: number } | null;
  lastActionAt: string | null;
};

export async function fetchProductCatalogRows(options?: {
  limit?: number;
}): Promise<ProductCatalogRow[]> {
  const supabase = createAdminClient();
  const limit = options?.limit != null ? Math.max(1, Math.min(500, options.limit)) : 200;

  const { data: productsRaw, error } = await supabase
    .from("subiekt_products")
    .select("subiekt_tw_id, symbol, name, plu, note, last_seen_at")
    .order("last_seen_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);

  const products = (productsRaw ?? []).map((p) => ({
    subiektTwId: Number(p.subiekt_tw_id),
    symbol: (p.symbol as string | null) ?? null,
    name: (p.name as string | null) ?? null,
    plu: (p.plu as string | null) ?? null,
    note: String(p.note ?? ""),
    lastSeenAt: String(p.last_seen_at ?? ""),
  }));

  const twIds = products.map((p) => p.subiektTwId).filter((id) => id > 0);
  if (!twIds.length) return [];

  const { data: linksRaw, error: linksErr } = await supabase
    .from("product_supplier_links")
    .select("subiekt_tw_id, supplier_id, order_count, last_action_at, suppliers(name)")
    .in("subiekt_tw_id", twIds);

  if (linksErr) throw new Error(linksErr.message);

  const byTwId = new Map<number, Array<{
    supplierId: string;
    supplierName: string;
    orderCount: number;
    lastActionAt: string;
  }>>();

  for (const row of linksRaw ?? []) {
    const twId = Number(row.subiekt_tw_id);
    const supplierId = String(row.supplier_id);
    const orderCount = Number(row.order_count ?? 0);
    const lastActionAt = String(row.last_action_at ?? "");
    const supplierName =
      (row as any).suppliers?.name != null ? String((row as any).suppliers.name) : "Dostawca";

    const list = byTwId.get(twId) ?? [];
    list.push({ supplierId, supplierName, orderCount, lastActionAt });
    byTwId.set(twId, list);
  }

  return products.map((p) => {
    const links = byTwId.get(p.subiektTwId) ?? [];
    let totalOrders = 0;
    let top: ProductCatalogRow["topSupplier"] = null;
    let lastActionAt: string | null = null;
    for (const l of links) {
      totalOrders += l.orderCount;
      if (!top || l.orderCount > top.orderCount) {
        top = { id: l.supplierId, name: l.supplierName, orderCount: l.orderCount };
      }
      if (!lastActionAt || l.lastActionAt > lastActionAt) lastActionAt = l.lastActionAt;
    }

    return {
      ...p,
      totalOrders,
      topSupplier: top,
      lastActionAt,
    };
  });
}

