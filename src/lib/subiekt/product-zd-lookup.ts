import type { IndividualOrder, OrderType, StatsMode } from "@/types/database";
import { fetchDeliveryStats } from "@/lib/data/queries";
import { getAppSupplierRefsCached } from "@/lib/data/supplier-refs";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDateString } from "@/lib/orders/dates";
import { estimateDeliveryEta } from "@/lib/orders/delivery-eta";
import { orderPlacementAt } from "@/lib/orders/order-timing";
import { isSubiektReachable } from "@/lib/subiekt/availability";
import {
  SubiektNetworkError,
  SubiektNotConfiguredError,
  SubiektRequestError,
  SubiektTimeoutError,
} from "@/lib/subiekt/errors";
import type { AppSupplierRef } from "@/lib/subiekt/match-supplier";
import {
  findBestMatchingZdDocument,
  orderMatchesZdDocument,
} from "@/lib/subiekt/match-order-to-zd";
import {
  getSubiektZdDocumentCached,
  searchSubiektZdCachedForEta,
} from "@/lib/subiekt/subiekt-runtime-cache";
import type { SubiektDocument, SubiektProduct } from "@/lib/subiekt/types";
import { extractAnyKhLabelFromDocument } from "@/lib/subiekt/kontrahent-from-document";
import { lineTowId } from "@/lib/subiekt/zd-catalog-import";
import {
  isActiveZdFulfillmentDocument,
  parseZdFulfillmentDeadline,
  shouldSkipZdListItemForEta,
} from "@/lib/subiekt/zd-fulfillment-date";
import { browseZdDocumentsForKhIds } from "@/lib/subiekt/zd-eta-browse";
import { sortZdCandidatesByNewestIssue } from "@/lib/subiekt/zd-placement-sort";
import {
  liveSearchZdDocsForOrder,
  resolveSupplierKhIds,
  buildZdIndexSearchEarlyStopHandlers,
  zdDocumentMatchesSupplierKhIds,
} from "@/lib/subiekt/zd-eta-sync";
import { loadSupplierHistoriaOrderDates } from "@/lib/orders/supplier-historia-order-dates";
import {
  filterZdIndexRowsForPlacements,
  loadZdIndexRowsForPlacements,
  loadZdIndexRowsForSupplierSync,
  searchZdFromIndexForOrder,
} from "@/lib/subiekt/zd-eta-index-search";
import {
  buildZdSearchPlacements,
  earliestZdContractorExtendedDataOd,
  sortMonthChunksNewestFirst,
  sortMonthChunksNearPlacement,
  zdContractorExtendedDataOd,
  zdContractorExtendedDataOdForPlacement,
  zdMergedPlacementBrowseMonthChunks,
} from "@/lib/subiekt/zd-search-scope";
import {
  effectiveProductSymbol,
  prioritizeZdLiveSearchPlans,
  zdSearchPlansForOrderWithKhIds,
} from "@/lib/subiekt/zd-search-for-product";
import { subiektFieldText } from "@/lib/subiekt/product-pick";

export const PRODUCT_ZD_LOOKUP_MAX_MATCHES = 3;
export const PRODUCT_ZD_LOOKUP_MAX_PLANS = 3;
/** Jak w sync ZD na /moje — wystarczająco na jedno trafienie u dostawcy. */
export const PRODUCT_ZD_LOOKUP_MAX_DOCS = 24;
export const PRODUCT_ZD_LOOKUP_INDEX_LIMIT = 96;
/** Dodatkowy budżet browse wokół miesiąca zamówienia (np. ZD z poprzedniego miesiąca). */
export const PRODUCT_ZD_LOOKUP_PLACEMENT_BROWSE_MAX_DOCS = 48;
/** Stronicowanie listy API po symbolu towaru u dostawcy (np. ZD 113 na str. 6 w maju). */
export const PRODUCT_ZD_LOOKUP_SYMBOL_LIST_MAX_PAGES = 12;
export const PRODUCT_ZD_LOOKUP_SYMBOL_PAGE_SIZE = 25;
/** Ile pełnych ZD ładujemy z listy po symbolu (po filtrze daty i sortowaniu). */
export const PRODUCT_ZD_LOOKUP_SYMBOL_MAX_DOCS = 192;
/** Min. pełnych ZD na jedno okno miesięczne — żeby nie wyczerpać budżetu w jednym miesiącu. */
export const PRODUCT_ZD_LOOKUP_SYMBOL_MIN_DOCS_PER_CHUNK = 12;

export type ProductZdLookupMatch = {
  dokId: number;
  dokNr: string;
  deadline: string;
  supplierId: string | null;
  supplierName: string | null;
  quantity: number | null;
};

export type ProductZdLookupAppOrderHint = {
  orderId: string;
  orderedAt: string;
  orderType: OrderType;
  estimatedDeadline: string;
  estimateLabel: string;
  lowConfidence: boolean;
};

export type ProductZdLookupResult =
  | {
      status: "found";
      supplierName: string | null;
      supplierId: string | null;
      matches: ProductZdLookupMatch[];
      searchIncomplete?: boolean;
    }
  | {
      status: "no_match";
      supplierName: string | null;
      supplierId: string | null;
      searchIncomplete?: boolean;
      appOrderHint?: ProductZdLookupAppOrderHint | null;
    }
  | {
      status: "needs_supplier";
      message: string;
    }
  | {
      status: "supplier_unmapped";
      supplierId: string | null;
      supplierName: string | null;
      message: string;
    }
  | { status: "offline"; message: string }
  | { status: "invalid_product"; message: string };

export type ProductZdLookupOptions = {
  /** Gdy brak wpisu w product_supplier_links — dostawca wybrany ręcznie. */
  supplierId?: string | null;
};

type SupplierResolution = {
  supplierId: string | null;
  supplierName: string | null;
};

export type ProductLookupContext = {
  placementAt: string | null;
  supplierId: string | null;
  supplierName: string | null;
  openOrder: {
    id: string;
    supplierId: string;
    orderType: OrderType;
    orderedAt: string;
    statsMode: StatsMode;
  } | null;
};

const OPEN_ORDER_STATUSES = ["Zamowione", "Czesciowo_zrealizowane"] as const;

type OpenOrderRow = Pick<
  IndividualOrder,
  "id" | "supplier_id" | "ordered_at" | "action_at" | "status" | "order_type"
> & {
  suppliers: { name: string | null; stats_mode: StatsMode | null } | null;
};

function normalizeOpenOrderRows(data: unknown): OpenOrderRow[] {
  if (!Array.isArray(data)) return [];
  return data.map((row) => {
    const suppliers = (row as { suppliers?: unknown }).suppliers;
    const supplier = Array.isArray(suppliers)
      ? (suppliers[0] as OpenOrderRow["suppliers"])
      : (suppliers as OpenOrderRow["suppliers"]);
    return {
      ...(row as OpenOrderRow),
      suppliers: supplier ?? null,
    };
  });
}

export function buildAppOrderDeliveryEstimate(input: {
  placementAt: string;
  orderType: OrderType;
  statsMode: StatsMode;
  deliveryStats: Awaited<ReturnType<typeof fetchDeliveryStats>>;
  supplierId: string;
}): ProductZdLookupAppOrderHint | null {
  const stats = input.deliveryStats.find((row) => row.supplier_id === input.supplierId) ?? null;
  const estimate = estimateDeliveryEta(
    input.placementAt,
    stats,
    input.orderType,
    input.statsMode
  );
  if (!estimate) return null;
  return {
    orderId: "",
    orderedAt: input.placementAt,
    orderType: input.orderType,
    estimatedDeadline: formatDateString(estimate.expectedDate, "yyyy-MM-dd"),
    estimateLabel: `ok. ${formatDateString(estimate.expectedDate, "dd.MM.yyyy")} · ~${estimate.avgBusinessDays} dni rob.${
      estimate.lowConfidence ? " (mało danych)" : ""
    }`,
    lowConfidence: estimate.lowConfidence,
  };
}

export function resolveProductZdLookupAppOrderHint(
  context: ProductLookupContext,
  deliveryStats: Awaited<ReturnType<typeof fetchDeliveryStats>>
): ProductZdLookupAppOrderHint | null {
  const openOrder = context.openOrder;
  if (!openOrder) return null;
  const estimate = buildAppOrderDeliveryEstimate({
    placementAt: openOrder.orderedAt,
    orderType: openOrder.orderType,
    statsMode: openOrder.statsMode,
    supplierId: openOrder.supplierId,
    deliveryStats,
  });
  if (!estimate) return null;
  return { ...estimate, orderId: openOrder.id };
}

export function mergeProductLookupSupplier(
  catalogSupplier: SupplierResolution
): SupplierResolution {
  return catalogSupplier;
}

/** Prośba syntetyczna do tych samych helperów co sync ZD na /moje. */
export function productLookupSearchOrder(
  product: SubiektProduct,
  placementAt: string | null
): IndividualOrder {
  const base = productToZdLookupOrder(product);
  const at = placementAt ?? new Date().toISOString();
  return {
    ...base,
    id: "product-zd-lookup",
    supplier_id: null,
    sales_person_id: "product-zd-lookup",
    order_type: "None",
    request_kind: "zamowienie",
    ordered_at: placementAt,
    action_at: at,
    status: placementAt ? "Zamowione" : "Nowe",
    delivery_at: null,
    subiekt_tw_id: base.subiekt_tw_id,
    mikran_code: base.mikran_code,
    zd_fulfillment_deadline: null,
    zd_fulfillment_dok_nr: null,
    zd_fulfillment_synced_at: null,
    zd_fulfillment_previous_deadline: null,
    zd_fulfillment_deadline_changed_at: null,
    zd_fulfillment_deadline_change_seen_at: null,
    zd_fulfillment_dok_id: base.zd_fulfillment_dok_id,
  } as IndividualOrder;
}

export async function loadProductLookupContext(
  product: SubiektProduct,
  appSuppliers: AppSupplierRef[]
): Promise<ProductLookupContext> {
  const twId = Math.trunc(Number(product.tw_Id));
  const symbol = subiektFieldText(product.tw_Symbol);
  const supabase = createAdminClient();

  let rows: OpenOrderRow[] = [];

  if (Number.isFinite(twId) && twId > 0) {
    const { data, error } = await supabase
      .from("individual_orders")
      .select(
        "id, supplier_id, ordered_at, action_at, status, order_type, suppliers(name, stats_mode)"
      )
      .eq("subiekt_tw_id", twId)
      .in("status", [...OPEN_ORDER_STATUSES])
      .order("ordered_at", { ascending: false, nullsFirst: false })
      .limit(15);
    if (error) throw new Error(error.message);
    rows = normalizeOpenOrderRows(data);
  }

  if (!rows.length && symbol && symbol !== "-") {
    const { data, error } = await supabase
      .from("individual_orders")
      .select(
        "id, supplier_id, ordered_at, action_at, status, order_type, suppliers(name, stats_mode)"
      )
      .ilike("symbol", symbol)
      .in("status", [...OPEN_ORDER_STATUSES])
      .order("ordered_at", { ascending: false, nullsFirst: false })
      .limit(15);
    if (error) throw new Error(error.message);
    rows = normalizeOpenOrderRows(data);
  }

  if (!rows.length) {
    return { placementAt: null, supplierId: null, supplierName: null, openOrder: null };
  }

  const primary = rows[0]!;
  const placementAt = orderPlacementAt(primary) ?? null;
  const supplierCounts = new Map<string, number>();
  for (const row of rows) {
    if (!row.supplier_id) continue;
    supplierCounts.set(row.supplier_id, (supplierCounts.get(row.supplier_id) ?? 0) + 1);
  }

  let supplierId = primary.supplier_id ?? null;
  let bestCount = 0;
  for (const [id, count] of supplierCounts) {
    if (count > bestCount) {
      bestCount = count;
      supplierId = id;
    }
  }

  if (
    supplierId &&
    appSuppliers.length > 0 &&
    !appSuppliers.some((supplier) => supplier.id === supplierId)
  ) {
    supplierId = null;
  }

  const supplierName =
    primary.suppliers?.name ??
    (supplierId ? appSuppliers.find((supplier) => supplier.id === supplierId)?.name ?? null : null);

  const openOrderSupplierId = primary.supplier_id ?? supplierId;
  const openOrder =
    placementAt && primary.id && openOrderSupplierId
      ? {
          id: primary.id,
          supplierId: openOrderSupplierId,
          orderType: primary.order_type ?? "Glowne",
          orderedAt: placementAt,
          statsMode: (primary.suppliers?.stats_mode ?? "LACZNIE") as StatsMode,
        }
      : null;

  return { placementAt, supplierId, supplierName, openOrder };
}

function isSubiektOfflineError(error: unknown): boolean {
  return (
    error instanceof SubiektNetworkError ||
    error instanceof SubiektTimeoutError ||
    error instanceof SubiektNotConfiguredError ||
    (error instanceof SubiektRequestError && error.status >= 500)
  );
}

export function productToZdLookupOrder(
  product: SubiektProduct
): Pick<
  IndividualOrder,
  | "subiekt_tw_id"
  | "symbol"
  | "products"
  | "mikran_code"
  | "quantity"
  | "delivered_quantity"
  | "zd_fulfillment_dok_id"
> {
  const symbol = effectiveProductSymbol(product) || subiektFieldText(product.tw_Symbol) || "-";
  const twId = Math.trunc(Number(product.tw_Id));
  const mikranCode = subiektFieldText(product.tw_PLU);
  return {
    symbol,
    products: subiektFieldText(product.tw_Nazwa) || symbol,
    subiekt_tw_id: Number.isFinite(twId) && twId > 0 ? twId : null,
    mikran_code: mikranCode || null,
    quantity: "1",
    delivered_quantity: "0",
    zd_fulfillment_dok_id: null,
  };
}

function matchedLineQuantity(product: SubiektProduct, doc: SubiektDocument): number | null {
  const order = productToZdLookupOrder(product);
  if (!orderMatchesZdDocument(order, doc)) return null;
  const twId = order.subiekt_tw_id;
  for (const line of doc.dok_Pozycja ?? []) {
    if (twId && lineTowId(line) === twId) {
      const raw = line.ob_Ilosc;
      const qty = typeof raw === "number" ? raw : Number(raw);
      return Number.isFinite(qty) ? qty : null;
    }
  }
  return null;
}

function supplierNameForDoc(
  doc: SubiektDocument,
  appSuppliers: AppSupplierRef[],
  supplierId: string | null
): string | null {
  if (supplierId) {
    return appSuppliers.find((supplier) => supplier.id === supplierId)?.name ?? null;
  }
  return extractAnyKhLabelFromDocument(doc);
}

function toLookupMatch(
  product: SubiektProduct,
  doc: SubiektDocument,
  supplier: SupplierResolution,
  appSuppliers: AppSupplierRef[]
): ProductZdLookupMatch | null {
  const deadline = parseZdFulfillmentDeadline(doc);
  if (!deadline || !isActiveZdFulfillmentDocument(doc)) return null;
  const dokId = Math.trunc(Number(doc.dok_Id));
  if (!Number.isFinite(dokId) || dokId <= 0) return null;
  const dokNr = doc.dok_NrPelny?.trim() || `#${dokId}`;
  return {
    dokId,
    dokNr,
    deadline,
    supplierId: supplier.supplierId,
    supplierName:
      supplier.supplierName ?? supplierNameForDoc(doc, appSuppliers, supplier.supplierId),
    quantity: matchedLineQuantity(product, doc),
  };
}

export function rankProductZdLookupMatches(
  matches: ProductZdLookupMatch[]
): ProductZdLookupMatch[] {
  return [...matches].sort((a, b) => {
    const deadlineCmp = a.deadline.localeCompare(b.deadline);
    if (deadlineCmp !== 0) return deadlineCmp;
    return a.dokNr.localeCompare(b.dokNr, "pl");
  });
}

export function collectActiveProductZdMatches(
  product: SubiektProduct,
  docs: SubiektDocument[],
  supplier: SupplierResolution,
  appSuppliers: AppSupplierRef[]
): ProductZdLookupMatch[] {
  const order = productToZdLookupOrder(product);
  const rankedDocs = docs
    .filter((doc) => orderMatchesZdDocument(order, doc) && isActiveZdFulfillmentDocument(doc))
    .sort((a, b) => {
      const best = findBestMatchingZdDocument(order, [a, b]);
      if (best?.dok_Id === a.dok_Id) return -1;
      if (best?.dok_Id === b.dok_Id) return 1;
      const da = parseZdFulfillmentDeadline(a) ?? "";
      const db = parseZdFulfillmentDeadline(b) ?? "";
      return da.localeCompare(db);
    });

  const matches: ProductZdLookupMatch[] = [];
  const seen = new Set<number>();
  for (const doc of rankedDocs) {
    const match = toLookupMatch(product, doc, supplier, appSuppliers);
    if (!match || seen.has(match.dokId)) continue;
    seen.add(match.dokId);
    matches.push(match);
    if (matches.length >= PRODUCT_ZD_LOOKUP_MAX_MATCHES) break;
  }
  return rankProductZdLookupMatches(matches);
}

async function resolveSupplierForProduct(
  product: SubiektProduct,
  appSuppliers: AppSupplierRef[]
): Promise<SupplierResolution> {
  const twId = Math.trunc(Number(product.tw_Id));
  if (!Number.isFinite(twId) || twId <= 0) {
    return { supplierId: null, supplierName: null };
  }

  const supabase = createAdminClient();
  const { data: linksRaw, error } = await supabase
    .from("product_supplier_links")
    .select("supplier_id, order_count, last_source, suppliers(name)")
    .eq("subiekt_tw_id", twId);
  if (error) throw new Error(error.message);

  const links = (linksRaw ?? []).map((row) => {
    const supplierRow = row as {
      supplier_id: string | number;
      order_count?: number | null;
      last_source?: string | null;
      suppliers?: { name?: string | null } | null;
    };
    return {
      supplierId: String(supplierRow.supplier_id),
      orderCount: Number(supplierRow.order_count ?? 0),
      lastSource: (supplierRow.last_source as string | null) ?? null,
      supplierName:
        supplierRow.suppliers?.name != null ? String(supplierRow.suppliers.name) : "Dostawca",
    };
  });

  if (!links.length) return { supplierId: null, supplierName: null };

  const scoreSource = (source: string | null) =>
    source === "procurement_verification" ? 3 : source === "order_history" ? 2 : source === "zd_import" ? 1 : 0;
  links.sort((a, b) => {
    const countDiff = (b.orderCount ?? 0) - (a.orderCount ?? 0);
    if (countDiff !== 0) return countDiff;
    return scoreSource(b.lastSource) - scoreSource(a.lastSource);
  });

  const best = links[0]!;
  if (appSuppliers.length && !appSuppliers.some((supplier) => supplier.id === best.supplierId)) {
    return { supplierId: null, supplierName: null };
  }
  return { supplierId: best.supplierId, supplierName: best.supplierName };
}

async function loadProductSupplierIds(product: SubiektProduct): Promise<string[]> {
  const twId = Math.trunc(Number(product.tw_Id));
  if (!Number.isFinite(twId) || twId <= 0) return [];

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("product_supplier_links")
    .select("supplier_id")
    .eq("subiekt_tw_id", twId);
  if (error) throw new Error(error.message);

  const ids = new Set<string>();
  for (const row of data ?? []) {
    const supplierId = String((row as { supplier_id: string | number }).supplier_id ?? "").trim();
    if (supplierId) ids.add(supplierId);
  }
  return [...ids];
}

async function resolveProductSupplierKhIdsForLookup(
  product: SubiektProduct,
  supplierId: string | null,
  appSuppliers: AppSupplierRef[],
  extraKhBySupplierId: Map<string, number[]>
): Promise<number[]> {
  const khIds = new Set<number>();
  const addSupplier = (id: string | null | undefined) => {
    if (!id) return;
    const ref = appSuppliers.find((row) => row.id === id);
    for (const khId of resolveSupplierKhIds(ref, id, extraKhBySupplierId)) {
      khIds.add(khId);
    }
  };

  if (supplierId) {
    addSupplier(supplierId);
    return [...khIds];
  }

  for (const linkedSupplierId of await loadProductSupplierIds(product)) {
    addSupplier(linkedSupplierId);
  }
  return [...khIds];
}

async function loadExtraKhBySupplierId(): Promise<Map<string, number[]>> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("subiekt_zd_index")
    .select("supplier_id, subiekt_kh_id")
    .not("supplier_id", "is", null);
  if (error) throw new Error(error.message);

  const map = new Map<string, Set<number>>();
  for (const row of data ?? []) {
    const supplierId = (row as { supplier_id: string | null }).supplier_id;
    const kh = Math.trunc(Number((row as { subiekt_kh_id: number }).subiekt_kh_id));
    if (!supplierId || !Number.isFinite(kh) || kh <= 0) continue;
    const set = map.get(supplierId) ?? new Set<number>();
    set.add(kh);
    map.set(supplierId, set);
  }

  const out = new Map<string, number[]>();
  for (const [supplierId, ids] of map) out.set(supplierId, [...ids]);
  return out;
}

async function fetchZdDocumentSafe(dokId: number): Promise<SubiektDocument | null> {
  try {
    return await getSubiektZdDocumentCached(dokId);
  } catch (error) {
    if (isSubiektOfflineError(error)) throw error;
    return null;
  }
}

function productZdDocumentMatchesLookup(
  order: IndividualOrder,
  doc: SubiektDocument,
  khIds: readonly number[]
): boolean {
  if (khIds.length > 0 && !zdDocumentMatchesSupplierKhIds(doc, khIds)) return false;
  if (!orderMatchesZdDocument(order, doc)) return false;
  return isActiveZdFulfillmentDocument(doc);
}

/**
 * Głębokie wyszukiwanie ZD po symbolu towaru w oknach miesięcznych (prośba + historia dostawcy).
 * API zwraca wiele ZD z tym towarem — stronicujemy i sortujemy wg daty wystawienia blisko zamówienia.
 */
export async function liveSearchProductZdBySymbolWindows(
  product: SubiektProduct,
  order: IndividualOrder,
  khIds: readonly number[],
  searchPlacements: readonly string[],
  placementAt: string | null,
  budget: number,
  skipDocIds: ReadonlySet<number>,
  loadDoc: (dokId: number) => Promise<SubiektDocument | null>
): Promise<{ docs: SubiektDocument[]; fetched: number; matched: SubiektDocument | null }> {
  const symbol = effectiveProductSymbol(product);
  if (!symbol || symbol.length < 3 || budget <= 0) {
    return { docs: [], fetched: 0, matched: null };
  }

  const merged = zdMergedPlacementBrowseMonthChunks(
    searchPlacements.length ? searchPlacements : placementAt ? [placementAt] : [],
    placementAt
  );
  const placementAnchor = placementAt ?? searchPlacements[0] ?? null;
  const chunks = placementAnchor
    ? sortMonthChunksNearPlacement(merged, placementAnchor)
    : sortMonthChunksNewestFirst(merged);

  const docs: SubiektDocument[] = [];
  let fetched = 0;
  const khIdList = khIds.length ? khIds : [null];
  const perChunkBudget =
    khIds.length > 0
      ? budget
      : Math.max(
          PRODUCT_ZD_LOOKUP_SYMBOL_MIN_DOCS_PER_CHUNK,
          Math.floor(budget / Math.max(chunks.length, 1))
        );

  for (const khId of khIdList) {
    for (const chunk of chunks) {
      if (fetched >= budget) break;
      let chunkFetched = 0;
      const listedIds = new Set<number>();

      const listings: { id: number; issueDate: string }[] = [];
      for (let page = 1; page <= PRODUCT_ZD_LOOKUP_SYMBOL_LIST_MAX_PAGES; page++) {
        const list = await searchSubiektZdCachedForEta({
          ...(khId != null ? { khId } : {}),
          symbol,
          dataOd: chunk.dataOd,
          dataDo: chunk.dataDo,
          page,
          pageSize: PRODUCT_ZD_LOOKUP_SYMBOL_PAGE_SIZE,
        });
        const rows = list.data ?? [];
        if (!rows.length) break;

        for (const row of rows) {
          if (shouldSkipZdListItemForEta(row)) continue;
          const id = Math.trunc(Number(row.dok_Id));
          if (!Number.isFinite(id) || id <= 0 || listedIds.has(id) || skipDocIds.has(id)) {
            continue;
          }
          const issueDate = (row.dok_DataWyst ?? "").slice(0, 10);
          if (issueDate < chunk.dataOd || (chunk.dataDo && issueDate >= chunk.dataDo)) {
            continue;
          }
          listedIds.add(id);
          listings.push({ id, issueDate });
        }

        if (rows.length < PRODUCT_ZD_LOOKUP_SYMBOL_PAGE_SIZE) break;
      }

      const ordered = sortZdCandidatesByNewestIssue(listings);

      for (const item of ordered) {
        if (fetched >= budget || chunkFetched >= perChunkBudget) break;
        const full = await loadDoc(item.id);
        if (!full) continue;
        if (khIds.length > 0 && !zdDocumentMatchesSupplierKhIds(full, khIds)) continue;
        fetched++;
        chunkFetched++;
        docs.push(full);
        if (productZdDocumentMatchesLookup(order, full, khIds)) {
          return { docs, fetched, matched: full };
        }
      }
    }
  }

  const matched = docs.find((doc) => productZdDocumentMatchesLookup(order, doc, khIds)) ?? null;
  return { docs, fetched, matched };
}

async function searchProductZdWithSupplier(
  product: SubiektProduct,
  supplier: SupplierResolution,
  appSuppliers: AppSupplierRef[],
  extraKhBySupplierId: Map<string, number[]>,
  placementAt: string | null,
  khIds: readonly number[]
): Promise<{ matches: ProductZdLookupMatch[]; searchIncomplete: boolean }> {
  const order = productLookupSearchOrder(product, placementAt);

  if (!khIds.length) {
    return { matches: [], searchIncomplete: false };
  }

  const syncAt = new Date();
  let historiaUnavailable = false;
  const supplierOrderDates = supplier.supplierId
    ? await loadSupplierHistoriaOrderDates(supplier.supplierId).catch((error) => {
        console.error("[product-zd-lookup] historia dostawcy niedostępna", error);
        historiaUnavailable = true;
        return [] as string[];
      })
    : [];
  const searchPlacements = buildZdSearchPlacements(placementAt, supplierOrderDates, syncAt);

  const skipDocIds = new Set<number>();
  const docs: SubiektDocument[] = [];
  let fetched = 0;
  let searchIncomplete = false;

  const indexPlacementInputs = searchPlacements.length
    ? searchPlacements
    : placementAt
      ? [placementAt]
      : [];
  const indexRows =
    indexPlacementInputs.length > 0
      ? await loadZdIndexRowsForPlacements(
          khIds,
          indexPlacementInputs,
          syncAt,
          PRODUCT_ZD_LOOKUP_INDEX_LIMIT
        )
      : await loadZdIndexRowsForSupplierSync(
          khIds,
          [],
          zdContractorExtendedDataOd(syncAt),
          syncAt,
          PRODUCT_ZD_LOOKUP_INDEX_LIMIT
        );
  const scopedIndexRows = filterZdIndexRowsForPlacements(indexRows, searchPlacements, syncAt);

  const indexBudget = PRODUCT_ZD_LOOKUP_MAX_DOCS;
  const indexSearch = await searchZdFromIndexForOrder(scopedIndexRows, {
    maxDocsToFetch: indexBudget,
    skipDocIds,
    loadDoc: fetchZdDocumentSafe,
    preferIssueDateNear: placementAt ?? searchPlacements[0] ?? undefined,
    ...buildZdIndexSearchEarlyStopHandlers(order, khIds),
  });
  fetched += indexSearch.fetched;
  for (const doc of indexSearch.docs) {
    if (!zdDocumentMatchesSupplierKhIds(doc, khIds)) continue;
    docs.push(doc);
    skipDocIds.add(Math.trunc(Number(doc.dok_Id)));
  }

  let matches = collectActiveProductZdMatches(product, docs, supplier, appSuppliers);
  if (matches.length > 0) {
    return {
      matches,
      searchIncomplete: indexSearch.stoppedEarly || fetched >= PRODUCT_ZD_LOOKUP_MAX_DOCS,
    };
  }

  const symbolBudget = Math.max(0, PRODUCT_ZD_LOOKUP_SYMBOL_MAX_DOCS - fetched);
  let symbolExhausted = false;
  if (symbolBudget > 0) {
    const symbolLive = await liveSearchProductZdBySymbolWindows(
      product,
      order,
      khIds,
      searchPlacements,
      placementAt,
      symbolBudget,
      skipDocIds,
      fetchZdDocumentSafe
    );
    fetched += symbolLive.fetched;
    symbolExhausted = symbolLive.fetched >= symbolBudget;
    for (const doc of symbolLive.docs) {
      docs.push(doc);
      skipDocIds.add(Math.trunc(Number(doc.dok_Id)));
    }
    matches = collectActiveProductZdMatches(product, docs, supplier, appSuppliers);
    if (matches.length > 0) {
      return {
        matches,
        searchIncomplete:
          fetched >= PRODUCT_ZD_LOOKUP_MAX_DOCS ||
          symbolLive.fetched >= symbolBudget,
      };
    }
  }

  const liveBudget = PRODUCT_ZD_LOOKUP_MAX_DOCS;
  if (liveBudget > 0) {
    const live = await liveSearchZdDocsForOrder(
      order,
      khIds,
      PRODUCT_ZD_LOOKUP_MAX_PLANS,
      liveBudget,
      liveBudget,
      skipDocIds,
      fetchZdDocumentSafe
    );
    fetched += live.fetched;
    const liveDocs = live.docs.filter((doc) => zdDocumentMatchesSupplierKhIds(doc, khIds));
    if (live.matched && zdDocumentMatchesSupplierKhIds(live.matched, khIds)) {
      matches = collectActiveProductZdMatches(
        product,
        [live.matched, ...liveDocs.filter((doc) => doc.dok_Id !== live.matched?.dok_Id)],
        supplier,
        appSuppliers
      );
    } else {
      matches = collectActiveProductZdMatches(
        product,
        [...docs, ...liveDocs],
        supplier,
        appSuppliers
      );
    }
  }

  if (matches.length === 0 && searchPlacements.length > 0) {
    const browseChunks = zdMergedPlacementBrowseMonthChunks(
      searchPlacements,
      placementAt ?? searchPlacements[0] ?? null,
      syncAt
    );
    const browseDataOd =
      searchPlacements.length > 1
        ? earliestZdContractorExtendedDataOd(searchPlacements, syncAt)
        : zdContractorExtendedDataOdForPlacement(placementAt, syncAt);

    const runPlacementBrowse = async (budget: number, maxPagesPerKh: number) => {
      if (budget <= 0) return [] as SubiektDocument[];
      const browse = await browseZdDocumentsForKhIds({
        khIds,
        dataOd: browseChunks[0]?.dataOd ?? browseDataOd,
        monthChunks: browseChunks,
        pageSize: 25,
        maxPagesPerKh,
        maxDocsToFetch: budget,
        skipDocIds,
        loadDoc: fetchZdDocumentSafe,
        preferIssueDateNear: placementAt ?? searchPlacements[0] ?? undefined,
        matchDoc: (doc) => productZdDocumentMatchesLookup(order, doc, khIds),
      });
      fetched += browse.fetched;
      if (browse.stoppedEarly) searchIncomplete = true;
      return browse.docs.filter((doc) => zdDocumentMatchesSupplierKhIds(doc, khIds));
    };

    const primaryBrowseBudget = Math.max(
      0,
      PRODUCT_ZD_LOOKUP_PLACEMENT_BROWSE_MAX_DOCS - fetched
    );
    let browseDocs = await runPlacementBrowse(primaryBrowseBudget, 8);
    matches = collectActiveProductZdMatches(
      product,
      [...docs, ...browseDocs],
      supplier,
      appSuppliers
    );

    if (matches.length === 0) {
      const extraBrowseBudget = Math.max(
        0,
        PRODUCT_ZD_LOOKUP_PLACEMENT_BROWSE_MAX_DOCS + PRODUCT_ZD_LOOKUP_MAX_DOCS - fetched
      );
      browseDocs = [
        ...browseDocs,
        ...(await runPlacementBrowse(extraBrowseBudget, 12)),
      ];
      matches = collectActiveProductZdMatches(
        product,
        [...docs, ...browseDocs],
        supplier,
        appSuppliers
      );
    }
  }

  searchIncomplete =
    searchIncomplete ||
    historiaUnavailable ||
    indexSearch.stoppedEarly ||
    scopedIndexRows.length > indexSearch.fetched ||
    symbolExhausted ||
    fetched >= PRODUCT_ZD_LOOKUP_SYMBOL_MAX_DOCS + PRODUCT_ZD_LOOKUP_PLACEMENT_BROWSE_MAX_DOCS;

  return { matches, searchIncomplete };
}

export async function lookupProductZdDelivery(
  product: SubiektProduct,
  options: ProductZdLookupOptions = {}
): Promise<ProductZdLookupResult> {
  const twId = Math.trunc(Number(product.tw_Id));
  if (!Number.isFinite(twId) || twId <= 0) {
    return {
      status: "invalid_product",
      message: "Wybierz produkt z listy Subiekta — potrzebujemy poprawnego ID towaru.",
    };
  }

  const reachable = await isSubiektReachable();
  if (!reachable) {
    return {
      status: "offline",
      message:
        "Subiekt jest teraz niedostępny — nie możemy sprawdzić ZD. Spróbuj ponownie, gdy połączenie wróci.",
    };
  }

  try {
    const appSuppliers = await getAppSupplierRefsCached();
    const [extraKhBySupplierId, context, catalogSupplier] = await Promise.all([
      loadExtraKhBySupplierId(),
      loadProductLookupContext(product, appSuppliers),
      resolveSupplierForProduct(product, appSuppliers),
    ]);

    const manualSupplierId = options.supplierId?.trim() || null;
    if (!catalogSupplier.supplierId && !manualSupplierId) {
      return {
        status: "needs_supplier",
        message:
          "Nie mamy przypisanego dostawcy do tego towaru w bazie. Wybierz dostawcę, u którego szukamy ZD.",
      };
    }

    const supplier: SupplierResolution = manualSupplierId
      ? {
          supplierId: manualSupplierId,
          supplierName:
            appSuppliers.find((row) => row.id === manualSupplierId)?.name ?? null,
        }
      : catalogSupplier;

    const khIds = await resolveProductSupplierKhIdsForLookup(
      product,
      manualSupplierId,
      appSuppliers,
      extraKhBySupplierId
    );

    if (!khIds.length) {
      return {
        status: "supplier_unmapped",
        supplierId: supplier.supplierId,
        supplierName: supplier.supplierName,
        message:
          "Wybrany dostawca nie ma powiązania z kontrahentem w Subiekcie — nie możemy przeszukać ZD.",
      };
    }

    const { matches, searchIncomplete } = await searchProductZdWithSupplier(
      product,
      supplier,
      appSuppliers,
      extraKhBySupplierId,
      context.placementAt,
      khIds
    );

    if (matches.length > 0) {
      return {
        status: "found",
        supplierId: supplier.supplierId,
        supplierName: supplier.supplierName,
        matches,
        searchIncomplete,
      };
    }

    const appOrderHint = context.openOrder
      ? resolveProductZdLookupAppOrderHint(context, await fetchDeliveryStats())
      : null;

    return {
      status: "no_match",
      supplierId: supplier.supplierId,
      supplierName: supplier.supplierName,
      searchIncomplete,
      appOrderHint,
    };
  } catch (error) {
    if (isSubiektOfflineError(error)) {
      return {
        status: "offline",
        message:
          "Subiekt jest teraz niedostępny — nie możemy sprawdzić ZD. Spróbuj ponownie, gdy połączenie wróci.",
      };
    }
    throw error;
  }
}

/** Pomocniczo — plany wyszukiwania przy znanym dostawcy (testy / diagnostyka). */
export function productZdLookupSearchPlanCount(
  product: SubiektProduct,
  appSuppliers: AppSupplierRef[],
  khIds: readonly number[]
): number {
  const order = productToZdLookupOrder(product);
  return prioritizeZdLiveSearchPlans(
    zdSearchPlansForOrderWithKhIds(
      {
        symbol: order.symbol,
        products: order.products,
        subiekt_tw_id: order.subiekt_tw_id,
      },
      khIds
    ),
    { primaryKhId: khIds[0] ?? null, maxPlans: PRODUCT_ZD_LOOKUP_MAX_PLANS }
  ).length;
}
