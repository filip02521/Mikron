import { cache } from "react";
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

export type ProductCatalogPage = {
  rows: ProductCatalogRow[];
  total: number;
  offset: number;
  limit: number;
};

export type ProductCatalogCoverageStats = {
  totalProducts: number;
  withSupplier: number;
  withoutSupplier: number;
};

/** Limit PostgREST / Supabase na jedną stronę (domyślnie 1000). */
const SUPABASE_PAGE = 1000;

/**
 * Wszystkie tw_Id mające choć jeden wiersz w product_supplier_links.
 * Paginujemy po wierszach linków (nie po unikalnych tw_Id) — inaczej przy wielu
 * dostawcach na produkt zbieramy tylko część mapowań i fałszywie pokazujemy „bez dostawcy”.
 */
const fetchLinkedSubiektTwIdSet = cache(async (): Promise<Set<number>> => {
  const supabase = createAdminClient();
  const linked = new Set<number>();
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from("product_supplier_links")
      .select("subiekt_tw_id")
      .order("subiekt_tw_id", { ascending: true })
      .order("supplier_id", { ascending: true })
      .range(offset, offset + SUPABASE_PAGE - 1);
    if (error) throw new Error(error.message);
    const batch = data ?? [];
    for (const row of batch) {
      const id = Number((row as { subiekt_tw_id: unknown }).subiekt_tw_id);
      if (Number.isFinite(id) && id > 0) linked.add(Math.trunc(id));
    }
    if (batch.length < SUPABASE_PAGE) break;
    offset += SUPABASE_PAGE;
  }

  return linked;
});

/** Produkty w katalogu bez żadnego powiązania w product_supplier_links. */
export async function countProductCatalogCoverage(): Promise<ProductCatalogCoverageStats> {
  const supabase = createAdminClient();
  const linked = await fetchLinkedSubiektTwIdSet();
  const batchSize = 1000;
  let offset = 0;
  let withSupplier = 0;
  let withoutSupplier = 0;

  while (true) {
    const { data, error } = await supabase
      .from("subiekt_products")
      .select("subiekt_tw_id")
      .order("last_seen_at", { ascending: false })
      .range(offset, offset + batchSize - 1);
    if (error) throw new Error(error.message);
    const batch = data ?? [];
    for (const row of batch) {
      const id = Number((row as { subiekt_tw_id: unknown }).subiekt_tw_id);
      if (!Number.isFinite(id) || id <= 0) continue;
      if (linked.has(Math.trunc(id))) withSupplier++;
      else withoutSupplier++;
    }
    if (batch.length < batchSize) break;
    offset += batchSize;
  }

  return {
    totalProducts: withSupplier + withoutSupplier,
    withSupplier,
    withoutSupplier,
  };
}

async function listUnlinkedSubiektTwIds(): Promise<number[]> {
  const supabase = createAdminClient();
  const linked = await fetchLinkedSubiektTwIdSet();
  const unlinked: number[] = [];
  const batchSize = 1000;
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from("subiekt_products")
      .select("subiekt_tw_id")
      .order("last_seen_at", { ascending: false })
      .range(offset, offset + batchSize - 1);
    if (error) throw new Error(error.message);
    const batch = data ?? [];
    for (const row of batch) {
      const id = Number((row as { subiekt_tw_id: unknown }).subiekt_tw_id);
      if (Number.isFinite(id) && id > 0 && !linked.has(Math.trunc(id))) {
        unlinked.push(Math.trunc(id));
      }
    }
    if (batch.length < batchSize) break;
    offset += batchSize;
  }

  return unlinked;
}

export async function fetchProductsWithoutSupplierPage(options?: {
  limit?: number;
  offset?: number;
}): Promise<ProductCatalogPage> {
  const limit = options?.limit != null ? Math.max(1, Math.min(500, options.limit)) : 250;
  const offset = options?.offset != null ? Math.max(0, options.offset) : 0;
  const allUnlinked = await listUnlinkedSubiektTwIds();
  const total = allUnlinked.length;
  const slice = allUnlinked.slice(offset, offset + limit);
  const rows = await fetchProductCatalogRowsByTwIds(slice);
  return { rows, total, offset, limit };
}

/** Wyszukiwanie tylko wśród produktów bez mapowania dostawcy. */
export async function searchProductsWithoutSupplierPage(options: {
  query: string;
  limit?: number;
  offset?: number;
}): Promise<ProductCatalogPage> {
  const limit = options.limit != null ? Math.max(1, Math.min(500, options.limit)) : 250;
  const offset = options.offset != null ? Math.max(0, options.offset) : 0;
  const q = options.query.trim();
  if (!q) return fetchProductsWithoutSupplierPage({ limit, offset });

  const linked = await fetchLinkedSubiektTwIdSet();
  const unlinkedIds: number[] = [];
  const searchPage = 200;
  let searchOffset = 0;
  let searchTotal = 0;

  while (true) {
    const page = await searchProductCatalogPage({
      query: q,
      limit: searchPage,
      offset: searchOffset,
    });
    searchTotal = page.total;
    for (const row of page.rows) {
      if (!linked.has(row.subiektTwId)) unlinkedIds.push(row.subiektTwId);
    }
    if (page.rows.length < searchPage || searchOffset + searchPage >= searchTotal) break;
    searchOffset += searchPage;
  }

  const total = unlinkedIds.length;
  const slice = unlinkedIds.slice(offset, offset + limit);
  const rows = await fetchProductCatalogRowsByTwIds(slice);
  return { rows, total, offset, limit };
}

export async function fetchProductCatalogRowsByTwIds(twIds: number[]): Promise<ProductCatalogRow[]> {
  const supabase = createAdminClient();
  if (!twIds.length) return [];

  const { data: productsRaw, error } = await supabase
    .from("subiekt_products")
    .select("subiekt_tw_id, symbol, name, plu, note, last_seen_at")
    .in("subiekt_tw_id", twIds);
  if (error) throw new Error(error.message);

  const products = (productsRaw ?? []).map((p) => ({
    subiektTwId: Number(p.subiekt_tw_id),
    symbol: (p.symbol as string | null) ?? null,
    name: (p.name as string | null) ?? null,
    plu: (p.plu as string | null) ?? null,
    note: String(p.note ?? ""),
    lastSeenAt: String(p.last_seen_at ?? ""),
  }));

  const { data: linksRaw, error: linksErr } = await supabase
    .from("product_supplier_links")
    .select("subiekt_tw_id, supplier_id, order_count, last_action_at, suppliers(name)")
    .in("subiekt_tw_id", twIds);
  if (linksErr) throw new Error(linksErr.message);

  const byTwId = new Map<
    number,
    Array<{ supplierId: string; supplierName: string; orderCount: number; lastActionAt: string }>
  >();

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

  const byId = new Map<number, ProductCatalogRow>();
  for (const p of products) {
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
    byId.set(p.subiektTwId, { ...p, totalOrders, topSupplier: top, lastActionAt });
  }

  // zachowaj kolejność jak w wejściu (offset/ordering już zrobione wcześniej)
  return twIds.map((id) => byId.get(id)).filter(Boolean) as ProductCatalogRow[];
}

export async function fetchProductCatalogPage(options?: {
  limit?: number;
  offset?: number;
}): Promise<ProductCatalogPage> {
  const supabase = createAdminClient();
  const limit = options?.limit != null ? Math.max(1, Math.min(500, options.limit)) : 250;
  const offset = options?.offset != null ? Math.max(0, options.offset) : 0;

  const { data: idsRaw, count, error: idsErr } = await supabase
    .from("subiekt_products")
    .select("subiekt_tw_id", { count: "exact" })
    .order("last_seen_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (idsErr) throw new Error(idsErr.message);

  const total = Number(count ?? 0);

  const twIds = (idsRaw ?? []).map((r) => Number((r as any).subiekt_tw_id)).filter((n) => n > 0);
  const rows = await fetchProductCatalogRowsByTwIds(twIds);
  return { rows, total, offset, limit };
}

export async function searchProductCatalogPage(options: {
  query: string;
  limit?: number;
  offset?: number;
}): Promise<ProductCatalogPage> {
  const supabase = createAdminClient();
  const limit = options.limit != null ? Math.max(1, Math.min(500, options.limit)) : 250;
  const offset = options.offset != null ? Math.max(0, options.offset) : 0;
  const q = options.query.trim();
  if (!q) return fetchProductCatalogPage({ limit, offset });

  const twId = /^\d+$/.test(q) ? Number(q) : null;
  const pattern = `%${q.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;

  let query = supabase
    .from("subiekt_products")
    .select("subiekt_tw_id", { count: "exact" })
    .order("last_seen_at", { ascending: false });

  if (twId && Number.isFinite(twId)) {
    query = query.eq("subiekt_tw_id", Math.trunc(twId));
  } else {
    // symbol/name/plu/note - ilike po całej bazie (server-side)
    query = query.or(
      `symbol.ilike.${pattern},name.ilike.${pattern},plu.ilike.${pattern},note.ilike.${pattern}`
    );
  }

  const { data: idsRaw, count, error } = await query.range(offset, offset + limit - 1);
  if (error) throw new Error(error.message);

  const total = Number(count ?? 0);
  const twIds = (idsRaw ?? []).map((r) => Number((r as any).subiekt_tw_id)).filter((n) => n > 0);
  const rows = await fetchProductCatalogRowsByTwIds(twIds);
  return { rows, total, offset, limit };
}

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

