import {
  getSubiektDocument,
  searchSubiektCustomers,
  searchSubiektKontrahenci,
  searchSubiektSuppliers,
  searchSubiektZd,
  type SubiektListParams,
} from "@/lib/subiekt/api";
import type {
  SubiektDocument,
  SubiektKontrahent,
  SubiektListEnvelope,
} from "@/lib/subiekt/types";

/** Współdzielony cache w procesie Node — ogranicza powtórne odczyty tego samego ZD / tej samej listy. */
export const SUBIEKT_RUNTIME_CACHE_TTL_MS = 2 * 60 * 60 * 1000;

const MAX_DOC_ENTRIES = 400;
const MAX_LIST_ENTRIES = 200;
const MAX_SUPPLIER_SEARCH_ENTRIES = 120;
const MAX_CUSTOMER_SEARCH_ENTRIES = 120;

/** Krótszy TTL — wyszukiwarka dostawcy przy prośbach. */
export const SUBIEKT_SUPPLIER_SEARCH_TTL_MS = 30 * 60 * 1000;

type CacheEntry<T> = { value: T; expiresAt: number };

const documentById = new Map<number, CacheEntry<SubiektDocument>>();
const documentInflight = new Map<number, Promise<SubiektDocument>>();
const zdListByKey = new Map<string, CacheEntry<SubiektListEnvelope<SubiektDocument>>>();
const zdListInflight = new Map<string, Promise<SubiektListEnvelope<SubiektDocument>>>();
const supplierSearchByKey = new Map<
  string,
  CacheEntry<SubiektListEnvelope<SubiektKontrahent>>
>();
const supplierSearchInflight = new Map<
  string,
  Promise<SubiektListEnvelope<SubiektKontrahent>>
>();
const customerSearchByKey = new Map<
  string,
  CacheEntry<SubiektListEnvelope<SubiektKontrahent>>
>();
const customerSearchInflight = new Map<
  string,
  Promise<SubiektListEnvelope<SubiektKontrahent>>
>();
const kontrahenciSearchByKey = new Map<
  string,
  CacheEntry<SubiektListEnvelope<SubiektKontrahent>>
>();
const kontrahenciSearchInflight = new Map<
  string,
  Promise<SubiektListEnvelope<SubiektKontrahent>>
>();

function pruneMap<T>(map: Map<number | string, CacheEntry<T>>, max: number) {
  if (map.size <= max) return;
  const drop = map.size - max;
  let i = 0;
  for (const key of map.keys()) {
    map.delete(key);
    if (++i >= drop) break;
  }
}

function listCacheKey(params: SubiektListParams): string {
  return JSON.stringify({
    search: params.search ?? "",
    symbol: params.symbol ?? "",
    khId: params.khId ?? "",
    dataOd: params.dataOd ?? "",
    dataDo: params.dataDo ?? "",
    includeBlocked: params.includeBlocked ?? false,
    page: params.page ?? 1,
    pageSize: params.pageSize ?? 25,
  });
}

/** Pełny dokument ZD/TW — cache 2 h (wspólny dla handlowców i modułów). */
export async function getSubiektDocumentCached(
  dokId: number
): Promise<SubiektDocument> {
  const now = Date.now();
  const hit = documentById.get(dokId);
  if (hit && hit.expiresAt > now) return hit.value;

  const inflight = documentInflight.get(dokId);
  if (inflight) return inflight;

  const load = getSubiektDocument(dokId)
    .then((doc) => {
      documentById.set(dokId, {
        value: doc,
        expiresAt: Date.now() + SUBIEKT_RUNTIME_CACHE_TTL_MS,
      });
      pruneMap(documentById, MAX_DOC_ENTRIES);
      return doc;
    })
    .finally(() => {
      documentInflight.delete(dokId);
    });

  documentInflight.set(dokId, load);
  return load;
}

/** Lista ZD z wyszukiwarki — cache 2 h (ta sama fraza + dostawca + dataOd). */
export async function searchSubiektZdCached(
  params: SubiektListParams
): Promise<SubiektListEnvelope<SubiektDocument>> {
  const key = listCacheKey(params);
  const now = Date.now();
  const hit = zdListByKey.get(key);
  if (hit && hit.expiresAt > now) return hit.value;

  const inflight = zdListInflight.get(key);
  if (inflight) return inflight;

  const load = searchSubiektZd(params)
    .then((list) => {
      zdListByKey.set(key, {
        value: list,
        expiresAt: Date.now() + SUBIEKT_RUNTIME_CACHE_TTL_MS,
      });
      pruneMap(zdListByKey, MAX_LIST_ENTRIES);
      return list;
    })
    .finally(() => {
      zdListInflight.delete(key);
    });

  zdListInflight.set(key, load);
  return load;
}

/** Wyszukiwanie kontrahentów-dostawców — cache w procesie (typeahead). */
export async function searchSubiektSuppliersCached(
  params: SubiektListParams
): Promise<SubiektListEnvelope<SubiektKontrahent>> {
  const key = listCacheKey(params);
  const now = Date.now();
  const hit = supplierSearchByKey.get(key);
  if (hit && hit.expiresAt > now) return hit.value;

  const inflight = supplierSearchInflight.get(key);
  if (inflight) return inflight;

  const load = searchSubiektSuppliers(params)
    .then((list) => {
      supplierSearchByKey.set(key, {
        value: list,
        expiresAt: Date.now() + SUBIEKT_SUPPLIER_SEARCH_TTL_MS,
      });
      pruneMap(supplierSearchByKey, MAX_SUPPLIER_SEARCH_ENTRIES);
      return list;
    })
    .finally(() => {
      supplierSearchInflight.delete(key);
    });

  supplierSearchInflight.set(key, load);
  return load;
}

/** Wyszukiwanie odbiorców (klienci końcowi) — cache w procesie (typeahead). */
export async function searchSubiektCustomersCached(
  params: SubiektListParams
): Promise<SubiektListEnvelope<SubiektKontrahent>> {
  const key = `odbiorcy:${listCacheKey(params)}`;
  const now = Date.now();
  const hit = customerSearchByKey.get(key);
  if (hit && hit.expiresAt > now) return hit.value;

  const inflight = customerSearchInflight.get(key);
  if (inflight) return inflight;

  const load = searchSubiektCustomers(params)
    .then((list) => {
      customerSearchByKey.set(key, {
        value: list,
        expiresAt: Date.now() + SUBIEKT_SUPPLIER_SEARCH_TTL_MS,
      });
      pruneMap(customerSearchByKey, MAX_CUSTOMER_SEARCH_ENTRIES);
      return list;
    })
    .finally(() => {
      customerSearchInflight.delete(key);
    });

  customerSearchInflight.set(key, load);
  return load;
}

/** Wyszukiwanie kartoteki kontrahentów — cache w procesie (fallback klientów). */
export async function searchSubiektKontrahenciCached(
  params: SubiektListParams
): Promise<SubiektListEnvelope<SubiektKontrahent>> {
  const key = `kontrahenci:${listCacheKey(params)}`;
  const now = Date.now();
  const hit = kontrahenciSearchByKey.get(key);
  if (hit && hit.expiresAt > now) return hit.value;

  const inflight = kontrahenciSearchInflight.get(key);
  if (inflight) return inflight;

  const load = searchSubiektKontrahenci(params)
    .then((list) => {
      kontrahenciSearchByKey.set(key, {
        value: list,
        expiresAt: Date.now() + SUBIEKT_SUPPLIER_SEARCH_TTL_MS,
      });
      pruneMap(kontrahenciSearchByKey, MAX_CUSTOMER_SEARCH_ENTRIES);
      return list;
    })
    .finally(() => {
      kontrahenciSearchInflight.delete(key);
    });

  kontrahenciSearchInflight.set(key, load);
  return load;
}

/** Domyślny dolny zakres daty ZD — węższe wyszukiwanie niż cała historia. */
export function defaultZdSearchDataOd(monthsBack = 18): string {
  const d = new Date();
  d.setMonth(d.getMonth() - monthsBack);
  return d.toISOString().slice(0, 10);
}

/** Czyści cache (testy). */
export function clearSubiektRuntimeCache(): void {
  documentById.clear();
  documentInflight.clear();
  zdListByKey.clear();
  zdListInflight.clear();
  supplierSearchByKey.clear();
  supplierSearchInflight.clear();
  customerSearchByKey.clear();
  customerSearchInflight.clear();
  kontrahenciSearchByKey.clear();
  kontrahenciSearchInflight.clear();
}
