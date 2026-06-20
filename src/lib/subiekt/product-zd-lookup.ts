import type { IndividualOrder } from "@/types/database";
import { fetchSupplierSubiektKhAliases } from "@/lib/data/supplier-subiekt-kh";
import { getAppSupplierRefsCached } from "@/lib/data/supplier-refs";
import { createAdminClient } from "@/lib/supabase/admin";
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
  searchSubiektZdCached,
} from "@/lib/subiekt/subiekt-runtime-cache";
import type { SubiektDocument, SubiektProduct } from "@/lib/subiekt/types";
import { lineTowId } from "@/lib/subiekt/zd-catalog-import";
import {
  isActiveZdFulfillmentDocument,
  parseZdFulfillmentDeadline,
} from "@/lib/subiekt/zd-fulfillment-date";
import {
  liveSearchZdDocsForOrder,
  resolveSupplierKhIds,
  ZD_ETA_LIVE_SEARCH_MAX_PAGES,
} from "@/lib/subiekt/zd-eta-sync";
import {
  effectiveProductSymbol,
  prioritizeZdLiveSearchPlans,
  zdSearchPlansForOrderWithKhIds,
  zdSearchPlansForProductSupplierLookup,
} from "@/lib/subiekt/zd-search-for-product";

export const PRODUCT_ZD_LOOKUP_MAX_MATCHES = 3;
export const PRODUCT_ZD_LOOKUP_MAX_PLANS = 3;
export const PRODUCT_ZD_LOOKUP_MAX_DOCS = 8;

export type ProductZdLookupMatch = {
  dokId: number;
  dokNr: string;
  deadline: string;
  supplierId: string | null;
  supplierName: string | null;
  quantity: number | null;
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
    }
  | { status: "offline"; message: string }
  | { status: "invalid_product"; message: string };

type SupplierResolution = {
  supplierId: string | null;
  supplierName: string | null;
};

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
  const symbol = effectiveProductSymbol(product) || product.tw_Symbol?.trim() || "-";
  const twId = Math.trunc(Number(product.tw_Id));
  return {
    symbol,
    products: product.tw_Nazwa?.trim() || symbol,
    subiekt_tw_id: Number.isFinite(twId) && twId > 0 ? twId : null,
    mikran_code: product.tw_PLU?.trim() || null,
    quantity: 1,
    delivered_quantity: 0,
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
  const khLabel = doc.kh_Nazwa?.trim();
  return khLabel || null;
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

async function loadExtraKhBySupplierId(): Promise<Map<string, number[]>> {
  const aliases = await fetchSupplierSubiektKhAliases();
  const map = new Map<string, number[]>();
  for (const row of aliases) {
    const supplierId = String(row.supplier_id);
    const khId = Math.trunc(Number(row.subiekt_kh_id));
    if (!Number.isFinite(khId) || khId <= 0) continue;
    const list = map.get(supplierId) ?? [];
    list.push(khId);
    map.set(supplierId, list);
  }
  return map;
}

async function fetchZdDocumentSafe(dokId: number): Promise<SubiektDocument | null> {
  try {
    return await getSubiektZdDocumentCached(dokId);
  } catch (error) {
    if (isSubiektOfflineError(error)) throw error;
    return null;
  }
}

async function searchProductZdWithSupplier(
  product: SubiektProduct,
  supplier: SupplierResolution,
  appSuppliers: AppSupplierRef[],
  extraKhBySupplierId: Map<string, number[]>
): Promise<{ matches: ProductZdLookupMatch[]; searchIncomplete: boolean }> {
  const order = productToZdLookupOrder(product) as IndividualOrder;
  const supplierRef = appSuppliers.find((row) => row.id === supplier.supplierId);
  const khIds = supplier.supplierId
    ? resolveSupplierKhIds(supplierRef, supplier.supplierId, extraKhBySupplierId)
    : [];

  if (khIds.length > 0) {
    const live = await liveSearchZdDocsForOrder(
      order,
      khIds,
      PRODUCT_ZD_LOOKUP_MAX_PLANS,
      PRODUCT_ZD_LOOKUP_MAX_DOCS,
      PRODUCT_ZD_LOOKUP_MAX_DOCS,
      new Set<number>(),
      fetchZdDocumentSafe
    );
    const matches = collectActiveProductZdMatches(
      product,
      live.matched ? [live.matched, ...live.docs.filter((doc) => doc.dok_Id !== live.matched?.dok_Id)] : live.docs,
      supplier,
      appSuppliers
    );
    const searchIncomplete = live.fetched >= PRODUCT_ZD_LOOKUP_MAX_DOCS && matches.length === 0;
    return { matches, searchIncomplete };
  }

  return searchProductZdBroad(product, supplier, appSuppliers, false);
}

async function searchProductZdBroad(
  product: SubiektProduct,
  supplier: SupplierResolution,
  appSuppliers: AppSupplierRef[],
  searchIncompleteDefault: boolean
): Promise<{ matches: ProductZdLookupMatch[]; searchIncomplete: boolean }> {
  const order = productToZdLookupOrder(product);
  const allPlans = zdSearchPlansForProductSupplierLookup(product, appSuppliers);
  const plans = prioritizeZdLiveSearchPlans(allPlans, {
    primaryKhId: null,
    maxPlans: PRODUCT_ZD_LOOKUP_MAX_PLANS,
  });

  const docs: SubiektDocument[] = [];
  const seen = new Set<number>();
  let fetched = 0;
  let searchIncomplete = searchIncompleteDefault;

  for (const plan of plans) {
    if (fetched >= PRODUCT_ZD_LOOKUP_MAX_DOCS) break;
    for (let page = 1; page <= ZD_ETA_LIVE_SEARCH_MAX_PAGES; page++) {
      if (fetched >= PRODUCT_ZD_LOOKUP_MAX_DOCS) break;
      const list = await searchSubiektZdCached({ ...plan, page });
      const items = list.data ?? [];
      if (!items.length) break;
      for (const item of items) {
        if (fetched >= PRODUCT_ZD_LOOKUP_MAX_DOCS) break;
        const id = Math.trunc(Number(item.dok_Id));
        if (!Number.isFinite(id) || id <= 0 || seen.has(id)) continue;
        seen.add(id);
        const full = await fetchZdDocumentSafe(id);
        if (!full) continue;
        fetched++;
        if (orderMatchesZdDocument(order, full) && isActiveZdFulfillmentDocument(full)) {
          docs.push(full);
          const best = findBestMatchingZdDocument(order, docs);
          if (best && orderMatchesZdDocument(order, best)) {
            return {
              matches: collectActiveProductZdMatches(product, docs, supplier, appSuppliers),
              searchIncomplete: false,
            };
          }
        }
      }
      if (items.length < (plan.pageSize ?? 12)) break;
    }
  }

  if (fetched >= PRODUCT_ZD_LOOKUP_MAX_DOCS) searchIncomplete = true;
  return {
    matches: collectActiveProductZdMatches(product, docs, supplier, appSuppliers),
    searchIncomplete,
  };
}

export async function lookupProductZdDelivery(
  product: SubiektProduct
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
    const extraKhBySupplierId = await loadExtraKhBySupplierId();
    const supplier = await resolveSupplierForProduct(product, appSuppliers);

    const { matches, searchIncomplete } = supplier.supplierId
      ? await searchProductZdWithSupplier(product, supplier, appSuppliers, extraKhBySupplierId)
      : await searchProductZdBroad(product, supplier, appSuppliers, true);

    if (matches.length > 0) {
      return {
        status: "found",
        supplierId: supplier.supplierId,
        supplierName: supplier.supplierName,
        matches,
        searchIncomplete,
      };
    }

    return {
      status: "no_match",
      supplierId: supplier.supplierId,
      supplierName: supplier.supplierName,
      searchIncomplete,
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
