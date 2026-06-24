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

export function formatCatalogSupplierSubtitle(
  row: ProductCatalogRow,
  filteredSupplierId: string | null,
  filteredSupplierName: string | null
): string {
  if (filteredSupplierId && filteredSupplierName) {
    const main =
      row.topSupplier && row.topSupplier.id !== filteredSupplierId
        ? ` · główny: ${row.topSupplier.name} (${row.topSupplier.orderCount})`
        : "";
    return `${filteredSupplierName} (filtr)${main}`;
  }
  if (row.topSupplier) return `${row.topSupplier.name} (${row.topSupplier.orderCount})`;
  return "bez dostawcy";
}

/** Limit PostgREST / Supabase na jedną stronę (domyślnie 1000). */
const SUPABASE_PAGE = 1000;

type SubiektTwIdRow = {
  subiekt_tw_id: number | string;
};

function buildIlikePattern(q: string): string {
  return `%${q.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
}

function parseTwIdQuery(q: string): number | null {
  if (!/^\d+$/.test(q)) return null;
  const twId = Number(q);
  return Number.isFinite(twId) && twId > 0 ? Math.trunc(twId) : null;
}

/** Paginacja produktów dostawcy po last_seen_at (bez ładowania całego katalogu do pamięci). */
async function fetchSupplierLinkTwIdPage(options: {
  supplierId: string;
  limit: number;
  offset: number;
  productFilter?: { twId: number } | { textQuery: string };
}): Promise<{ twIds: number[]; total: number }> {
  const supabase = createAdminClient();
  let query = supabase
    .from("product_supplier_links")
    .select("subiekt_tw_id, subiekt_products!inner(last_seen_at)", { count: "exact" })
    .eq("supplier_id", options.supplierId);

  if (options.productFilter) {
    if ("twId" in options.productFilter) {
      query = query.eq("subiekt_tw_id", options.productFilter.twId);
    } else {
      const pattern = buildIlikePattern(options.productFilter.textQuery);
      query = query.or(
        `symbol.ilike.${pattern},name.ilike.${pattern},plu.ilike.${pattern},note.ilike.${pattern}`,
        { foreignTable: "subiekt_products" }
      );
    }
  }

  const { data, count, error } = await query
    .order("last_seen_at", { foreignTable: "subiekt_products", ascending: false })
    .range(options.offset, options.offset + options.limit - 1);
  if (error) throw new Error(error.message);

  const twIds = (data ?? [])
    .map((row) => Number((row as { subiekt_tw_id: unknown }).subiekt_tw_id))
    .filter((id) => Number.isFinite(id) && id > 0)
    .map((id) => Math.trunc(id));

  return { twIds, total: Number(count ?? 0) };
}

/** Wszystkie tw_Id pasujące do pól produktu (bez paginacji wyniku). */
async function listAllTwIdsFromProductTextSearch(q: string): Promise<number[]> {
  const supabase = createAdminClient();
  const pattern = buildIlikePattern(q);
  const ids: number[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from("subiekt_products")
      .select("subiekt_tw_id")
      .or(`symbol.ilike.${pattern},name.ilike.${pattern},plu.ilike.${pattern},note.ilike.${pattern}`)
      .order("last_seen_at", { ascending: false })
      .range(offset, offset + SUPABASE_PAGE - 1);
    if (error) throw new Error(error.message);
    const batch = data ?? [];
    for (const row of batch) {
      const id = Number((row as { subiekt_tw_id: unknown }).subiekt_tw_id);
      if (Number.isFinite(id) && id > 0) ids.push(Math.trunc(id));
    }
    if (batch.length < SUPABASE_PAGE) break;
    offset += SUPABASE_PAGE;
  }

  return ids;
}

/** Produkty powiązane z dostawcą, którego nazwa pasuje do zapytania. */
async function listTwIdsBySupplierNameMatch(q: string): Promise<number[]> {
  const supabase = createAdminClient();
  const pattern = buildIlikePattern(q);
  const ids: number[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from("product_supplier_links")
      .select("subiekt_tw_id, suppliers!inner(name)")
      .ilike("suppliers.name", pattern)
      .order("subiekt_tw_id", { ascending: true })
      .range(offset, offset + SUPABASE_PAGE - 1);
    if (error) throw new Error(error.message);
    const batch = data ?? [];
    for (const row of batch) {
      const id = Number((row as { subiekt_tw_id: unknown }).subiekt_tw_id);
      if (Number.isFinite(id) && id > 0) ids.push(Math.trunc(id));
    }
    if (batch.length < SUPABASE_PAGE) break;
    offset += SUPABASE_PAGE;
  }

  return ids;
}

export function mergeUniqueTwIds(...groups: number[][]): number[] {
  return [...new Set(groups.flat())];
}

function supplierNameFromLinkRow(
  suppliers: { name?: string | null } | { name?: string | null }[] | null | undefined
): string {
  if (suppliers == null) return "Dostawca";
  const name = Array.isArray(suppliers) ? suppliers[0]?.name : suppliers.name;
  return name != null ? String(name) : "Dostawca";
}

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

async function sortTwIdsByLastSeenAt(twIds: number[]): Promise<number[]> {
  if (!twIds.length) return [];
  const supabase = createAdminClient();
  const lastSeenByTwId = new Map<number, string>();
  const batchSize = 200;

  for (let i = 0; i < twIds.length; i += batchSize) {
    const batch = twIds.slice(i, i + batchSize);
    const { data, error } = await supabase
      .from("subiekt_products")
      .select("subiekt_tw_id, last_seen_at")
      .in("subiekt_tw_id", batch);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      const id = Number((row as { subiekt_tw_id: unknown }).subiekt_tw_id);
      if (Number.isFinite(id) && id > 0) {
        lastSeenByTwId.set(Math.trunc(id), String((row as { last_seen_at: unknown }).last_seen_at ?? ""));
      }
    }
  }

  return [...twIds].sort((a, b) =>
    (lastSeenByTwId.get(b) ?? "").localeCompare(lastSeenByTwId.get(a) ?? "")
  );
}

export async function fetchProductCatalogBySupplierPage(options: {
  supplierId: string;
  limit?: number;
  offset?: number;
}): Promise<ProductCatalogPage> {
  const limit = options.limit != null ? Math.max(1, Math.min(500, options.limit)) : 250;
  const offset = options.offset != null ? Math.max(0, options.offset) : 0;
  const supplierId = options.supplierId.trim();
  if (!supplierId) return fetchProductCatalogPage({ limit, offset });

  const { twIds, total } = await fetchSupplierLinkTwIdPage({
    supplierId,
    limit,
    offset,
  });
  const rows = await fetchProductCatalogRowsByTwIds(twIds);
  return { rows, total, offset, limit };
}

/** Wyszukiwanie wśród produktów powiązanych z wybranym dostawcą. */
export async function searchProductCatalogBySupplierPage(options: {
  supplierId: string;
  query: string;
  limit?: number;
  offset?: number;
}): Promise<ProductCatalogPage> {
  const limit = options.limit != null ? Math.max(1, Math.min(500, options.limit)) : 250;
  const offset = options.offset != null ? Math.max(0, options.offset) : 0;
  const supplierId = options.supplierId.trim();
  const q = options.query.trim();
  if (!supplierId) return searchProductCatalogPage({ query: q, limit, offset });
  if (!q) return fetchProductCatalogBySupplierPage({ supplierId, limit, offset });

  const twId = parseTwIdQuery(q);
  const { twIds, total } = await fetchSupplierLinkTwIdPage({
    supplierId,
    limit,
    offset,
    productFilter: twId != null ? { twId } : { textQuery: q },
  });
  const rows = await fetchProductCatalogRowsByTwIds(twIds);
  return { rows, total, offset, limit };
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
    const supplierName = supplierNameFromLinkRow(row.suppliers);

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
  supplierId?: string | null;
}): Promise<ProductCatalogPage> {
  const limit = options?.limit != null ? Math.max(1, Math.min(500, options.limit)) : 250;
  const offset = options?.offset != null ? Math.max(0, options.offset) : 0;
  const supplierId = options?.supplierId?.trim() ?? "";
  if (supplierId) return fetchProductCatalogBySupplierPage({ supplierId, limit, offset });

  const supabase = createAdminClient();

  const { data: idsRaw, count, error: idsErr } = await supabase
    .from("subiekt_products")
    .select("subiekt_tw_id", { count: "exact" })
    .order("last_seen_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (idsErr) throw new Error(idsErr.message);

  const total = Number(count ?? 0);

  const twIds = (idsRaw ?? []).map((r) => Number((r as SubiektTwIdRow).subiekt_tw_id)).filter((n) => n > 0);
  const rows = await fetchProductCatalogRowsByTwIds(twIds);
  return { rows, total, offset, limit };
}

export async function searchProductCatalogPage(options: {
  query: string;
  limit?: number;
  offset?: number;
  supplierId?: string | null;
}): Promise<ProductCatalogPage> {
  const limit = options.limit != null ? Math.max(1, Math.min(500, options.limit)) : 250;
  const offset = options.offset != null ? Math.max(0, options.offset) : 0;
  const q = options.query.trim();
  const supplierId = options.supplierId?.trim() ?? "";
  if (supplierId) return searchProductCatalogBySupplierPage({ supplierId, query: q, limit, offset });
  if (!q) return fetchProductCatalogPage({ limit, offset });

  const supabase = createAdminClient();
  const twId = parseTwIdQuery(q);

  if (twId != null) {
    const { data: idsRaw, count, error } = await supabase
      .from("subiekt_products")
      .select("subiekt_tw_id", { count: "exact" })
      .eq("subiekt_tw_id", twId)
      .range(offset, offset + limit - 1);
    if (error) throw new Error(error.message);
    const total = Number(count ?? 0);
    const twIds = (idsRaw ?? [])
      .map((r) => Number((r as SubiektTwIdRow).subiekt_tw_id))
      .filter((id) => id > 0);
    const rows = await fetchProductCatalogRowsByTwIds(twIds);
    return { rows, total, offset, limit };
  }

  const pattern = buildIlikePattern(q);
  const supplierNameTwIds = await listTwIdsBySupplierNameMatch(q);
  if (!supplierNameTwIds.length) {
    const query = supabase
      .from("subiekt_products")
      .select("subiekt_tw_id", { count: "exact" })
      .order("last_seen_at", { ascending: false })
      .or(`symbol.ilike.${pattern},name.ilike.${pattern},plu.ilike.${pattern},note.ilike.${pattern}`);

    const { data: idsRaw, count, error } = await query.range(offset, offset + limit - 1);
    if (error) throw new Error(error.message);

    const total = Number(count ?? 0);
    const twIds = (idsRaw ?? [])
      .map((r) => Number((r as SubiektTwIdRow).subiekt_tw_id))
      .filter((id) => id > 0);
    const rows = await fetchProductCatalogRowsByTwIds(twIds);
    return { rows, total, offset, limit };
  }

  const [productTwIds] = await Promise.all([listAllTwIdsFromProductTextSearch(q)]);
  const merged = mergeUniqueTwIds(productTwIds, supplierNameTwIds);
  const sorted = await sortTwIdsByLastSeenAt(merged);
  const total = sorted.length;
  const slice = sorted.slice(offset, offset + limit);
  const rows = await fetchProductCatalogRowsByTwIds(slice);
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
    const supplierName = supplierNameFromLinkRow(row.suppliers);

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

