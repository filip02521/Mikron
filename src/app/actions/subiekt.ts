"use server";

// @service-role-ok — autoryzacja require*(); service role z pełnym scope po warstwie aplikacji.

import { revalidatePath, updateTag } from "next/cache";
import {
  requireAdmin,
  requireAdminForMutation,
  requireOperations,
  requireSubiektLookup,
  requireSupplierManagement,
} from "@/lib/auth";
import { indexOrderLineToProductCatalog } from "@/lib/data/product-catalog";
import { createAdminClient } from "@/lib/supabase/admin";
import { searchSubiektKontrahenci, searchSubiektProducts } from "@/lib/subiekt/api";
import {
  mergeKontrahenciUnique,
  MIN_CLIENT_SEARCH_LENGTH,
} from "@/lib/subiekt/client-pick";
import { getAppSupplierRefsCached } from "@/lib/data/supplier-refs";
import {
  fetchSupplierSubiektKhAliases,
  findSupplierIdOwningKhId,
  type SupplierSubiektKhAliasRow,
} from "@/lib/data/supplier-subiekt-kh";
import {
  labelsMapToRecord,
  resolveSubiektKontrahentLabels,
} from "@/lib/subiekt/resolve-kontrahent-labels";
import {
  searchSubiektCustomersCached,
  searchSubiektKontrahenciCached,
  searchSubiektSuppliersCached,
} from "@/lib/subiekt/subiekt-runtime-cache";
import {
  isCombinedProductSearchField,
  expandProductNameSearchQueries,
  filterPluSuggestResultsForZdLookup,
  inferProductZdLookupSearchField,
  mergeSubiektProductSearchResults,
  minProductSearchLength,
  productSearchParams,
  rankSubiektProductsForLookupQuery,
  looksLikeProductSymbol,
  type ProductSearchField,
} from "@/lib/subiekt/product-pick";
import { getSubiektConfigSummary, isSubiektConfigured } from "@/lib/subiekt/config";
import { testSubiektConnection, type SubiektHealthResult } from "@/lib/subiekt/client";
import {
  getSubiektAvailability,
  isSubiektReachable,
  type SubiektAvailability,
} from "@/lib/subiekt/availability";
import {
  feedbackFromException,
  getSubiektFeedback,
  notFoundClientFeedback,
  notFoundProductFeedback,
  notFoundSupplierFeedback,
  type SubiektFeedback,
  catalogSupplierUnmappedFeedback,
} from "@/lib/subiekt/feedback";
import {
  formatSubiektKontrahentLabel,
  matchSubiektKontrahentToSupplier,
  type AppSupplierRef,
} from "@/lib/subiekt/match-supplier";
import { expandSupplierSearchQueries } from "@/lib/subiekt/supplier-search-tokens";
import type { SubiektKontrahent, SubiektProduct } from "@/lib/subiekt/types";
import type { ProsbaLineStockSnapshot } from "@/lib/orders/prosba-stock-check";
import { fetchProsbaLineStock } from "@/lib/orders/fetch-prosba-line-stock";
import { searchProductCatalogSuggestions } from "@/lib/orders/product-catalog-suggest";

export async function actionGetSubiektStatus() {
  await requireAdmin();
  return getSubiektConfigSummary();
}

export async function actionTestSubiektConnection(): Promise<SubiektHealthResult> {
  await requireAdminForMutation();
  return testSubiektConnection();
}

export type SubiektLookupResult<T> =
  | { ok: true; items: T[]; totalCount?: number; feedback?: SubiektFeedback }
  | { ok: false; feedback: SubiektFeedback };

function lookupFailure(e: unknown): { ok: false; feedback: SubiektFeedback } {
  return { ok: false, feedback: feedbackFromException(e) };
}

function validationFailure(code: "short_query" | "empty_query"): {
  ok: false;
  feedback: SubiektFeedback;
} {
  return { ok: false, feedback: getSubiektFeedback(code) };
}

/** Status Subiekt dla handlowca / zakupów (bez sekretów). */
export async function actionGetSubiektAvailability(options?: {
  force?: boolean;
}): Promise<SubiektAvailability> {
  await requireSubiektLookup();
  return getSubiektAvailability(options);
}

/** Czy podpowiedzi Subiekt są dostępne (LAN + env). */
export async function actionSubiektSuggestionsEnabled(): Promise<{
  enabled: boolean;
  catalogFallback?: boolean;
  feedback?: SubiektFeedback;
}> {
  await requireSubiektLookup();
  if (!isSubiektConfigured()) {
    return {
      enabled: false,
      feedback: getSubiektFeedback("not_configured"),
    };
  }
  const reachable = await isSubiektReachable();
  if (!reachable) {
    return {
      enabled: false,
      catalogFallback: true,
      feedback: getSubiektFeedback("subiekt_unavailable", {
        hint: "Subiekt offline — wpisz nazwę lub symbol, wyniki pojawią się z lokalnej bazy.",
      }),
    };
  }
  return { enabled: true };
}

/** Wyszukiwanie towaru — panel admina. */
export async function actionSubiektLookupProduct(
  query: string
): Promise<SubiektLookupResult<SubiektProduct>> {
  await requireAdmin();
  return suggestProducts(query);
}

/** Podpowiedzi towaru przy prośbach. */
export async function actionSubiektSuggestProducts(
  query: string,
  searchField: ProductSearchField = "name"
): Promise<SubiektLookupResult<SubiektProduct>> {
  await requireSubiektLookup();
  return suggestProducts(query, searchField);
}

function catalogSuggestionToSubiektProduct(
  s: Awaited<ReturnType<typeof searchProductCatalogSuggestions>>[number]
): SubiektProduct {
  return {
    tw_Id: s.subiektTwId,
    tw_Symbol: s.symbol,
    tw_Nazwa: s.name,
    tw_PLU: s.plu,
    tw_PodstKodKresk: null,
    tw_Rodzaj: null,
    tw_Zablokowany: null,
    tw_Stan: null,
    tw_StanRez: null,
    // Marker dla UI, że wynik pochodzi z naszej bazy offline.
    _source: "catalog",
    _topSupplier: s.topSupplier,
  };
}

export async function actionSuggestProducts(
  query: string,
  searchField: ProductSearchField = "name"
): Promise<SubiektLookupResult<SubiektProduct>> {
  await requireSubiektLookup();

  const reachable = await isSubiektReachable();
  if (reachable) {
    try {
      const result = await suggestProducts(query, searchField);

      // Subiekt zwrócił wyniki — uzupełnij o dostawców z naszej bazy dla wyników bez _topSupplier.
      if (result.ok && result.items.length > 0) {
        const enriched = await enrichSubiektResultsWithCatalogSuppliers(result.items);
        return { ...result, items: enriched };
      }

      // Subiekt znalazł 0 wyników — spróbuj katalogu lokalnego.
      if (result.ok && result.items.length === 0) {
        const fallback = await tryCatalogFallback(query);
        if (fallback) return fallback;
      }

      // Subiekt zwrócił błąd (np. 500) — spróbuj katalogu lokalnego.
      if (!result.ok) {
        const fallback = await tryCatalogFallback(query);
        if (fallback) return fallback;
      }

      return result;
    } catch (e) {
      // Subiekt reachable ale API zwróciło błąd — spróbuj katalogu lokalnego.
      const fallback = await tryCatalogFallback(query);
      if (fallback) return fallback;
      return lookupFailure(e);
    }
  }

  try {
    const suggestions = await searchProductCatalogSuggestions(query);
    if (suggestions.length === 0) {
      return {
        ok: true,
        items: [],
        totalCount: 0,
        feedback: getSubiektFeedback("subiekt_unavailable", {
          hint: "Brak produktu w lokalnej bazie. Wpisz dane ręcznie lub spróbuj ponownie w sieci firmowej.",
        }),
      };
    }
    return {
      ok: true,
      items: suggestions.map(catalogSuggestionToSubiektProduct),
      totalCount: suggestions.length,
      feedback: getSubiektFeedback("subiekt_unavailable", {
        hint: "Wyniki z lokalnej bazy — Subiekt offline.",
      }),
    };
  } catch (e) {
    return lookupFailure(e);
  }
}

/**
 * Uzupełnia wyniki z Subiekta o dostawcę z naszej bazy (product_supplier_links).
 * Wyniki z katalogu (z _topSupplier) są pomijane.
 */
async function enrichSubiektResultsWithCatalogSuppliers(
  items: SubiektProduct[]
): Promise<SubiektProduct[]> {
  const needsEnrich = items.filter(
    (p) => !p._topSupplier && Math.trunc(Number(p.tw_Id)) > 0
  );
  if (needsEnrich.length === 0) return items;

  const twIds = needsEnrich.map((p) => Math.trunc(Number(p.tw_Id)));
  const supplierMap = await batchLookupCatalogSuppliers(twIds);
  if (supplierMap.size === 0) return items;

  return items.map((p) => {
    const twId = Math.trunc(Number(p.tw_Id));
    const supplier = supplierMap.get(twId);
    if (supplier && !p._topSupplier) {
      return { ...p, _topSupplier: supplier };
    }
    return p;
  });
}

/** Batch lookup dostawców z product_supplier_links dla wielu tw_Id. */
async function batchLookupCatalogSuppliers(
  twIds: number[]
): Promise<Map<number, AppSupplierRef>> {
  if (twIds.length === 0) return new Map();
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("product_supplier_links")
    .select("subiekt_tw_id, supplier_id, order_count, last_source, suppliers(name)")
    .in("subiekt_tw_id", twIds);
  if (error) return new Map();

  const byTwId = new Map<number, Array<{
    supplierId: string;
    orderCount: number;
    lastSource: string | null;
    supplierName: string;
  }>>();

  for (const row of data ?? []) {
    const r = row as {
      subiekt_tw_id: number | string;
      supplier_id: string | number;
      order_count?: number | null;
      last_source?: string | null;
      suppliers?: { name?: string | null } | null;
    };
    const twId = Math.trunc(Number(r.subiekt_tw_id));
    if (twId <= 0) continue;
    if (!byTwId.has(twId)) byTwId.set(twId, []);
    byTwId.get(twId)!.push({
      supplierId: String(r.supplier_id),
      orderCount: Number(r.order_count ?? 0),
      lastSource: (r.last_source as string | null) ?? null,
      supplierName: r.suppliers?.name != null ? String(r.suppliers.name) : "Dostawca",
    });
  }

  const result = new Map<number, AppSupplierRef>();
  const scoreSource = (s: string | null) =>
    s === "procurement_verification" ? 3 : s === "order_history" ? 2 : s === "zd_import" ? 1 : 0;

  for (const [twId, links] of byTwId) {
    links.sort((a, b) => {
      const c = (b.orderCount ?? 0) - (a.orderCount ?? 0);
      if (c !== 0) return c;
      return scoreSource(b.lastSource) - scoreSource(a.lastSource);
    });
    const best = links[0]!;
    result.set(twId, { id: best.supplierId, name: best.supplierName });
  }

  return result;
}

async function tryCatalogFallback(
  query: string
): Promise<SubiektLookupResult<SubiektProduct> | null> {
  try {
    const suggestions = await searchProductCatalogSuggestions(query);
    if (suggestions.length === 0) return null;
    return {
      ok: true,
      items: suggestions.map(catalogSuggestionToSubiektProduct),
      totalCount: suggestions.length,
      feedback: getSubiektFeedback("subiekt_unavailable", {
        hint: "Wyniki z lokalnej bazy — API Subiekta zwróciło błąd.",
      }),
    };
  } catch {
    return null;
  }
}

/** Podpowiedzi towaru w modalu „Sprawdź termin dostawy” — symbol i kod Mikran równolegle. */
export async function actionSubiektSuggestProductsForZdLookup(
  query: string
): Promise<SubiektLookupResult<SubiektProduct>> {
  await requireSubiektLookup();
  return suggestProductsForZdLookup(query);
}

/** Podpowiedzi klienta końcowego (odbiorcy) przy prośbach handlowca. */
export async function actionSubiektSuggestClients(
  query: string
): Promise<SubiektLookupResult<SubiektKontrahent>> {
  await requireSubiektLookup();
  const q = query.trim();
  if (!q) return validationFailure("empty_query");
  if (q.length < MIN_CLIENT_SEARCH_LENGTH) return validationFailure("short_query");
  if (!isSubiektConfigured()) {
    return { ok: false, feedback: getSubiektFeedback("not_configured") };
  }

  const reachable = await isSubiektReachable();
  if (!reachable) {
    return {
      ok: true,
      items: [],
      feedback: getSubiektFeedback("subiekt_unavailable", {
        hint: "Wpisz nazwę klienta ręcznie — pole pozostaje opcjonalne.",
      }),
    };
  }

  try {
    const merged: SubiektKontrahent[] = [];
    const seenKh = new Set<number>();
    const seenLabels = new Set<string>();
    const phrases = expandSupplierSearchQueries(q).slice(0, 4);
    const listBase = {
      pageSize: 12,
      page: 1,
      includeBlocked: true,
    } as const;

    for (const phrase of phrases) {
      if (merged.length >= 12) break;
      const customersRes = await searchSubiektCustomersCached({
        ...listBase,
        search: phrase,
      });
      mergeKontrahenciUnique(
        merged,
        seenKh,
        seenLabels,
        customersRes.data ?? [],
        12
      );
    }

    if (merged.length < 8) {
      for (const phrase of phrases) {
        if (merged.length >= 12) break;
        const kontrahenciRes = await searchSubiektKontrahenciCached({
          ...listBase,
          search: phrase,
        });
        mergeKontrahenciUnique(
          merged,
          seenKh,
          seenLabels,
          kontrahenciRes.data ?? [],
          12
        );
      }
    }

    if (merged.length === 0) {
      return {
        ok: true,
        items: [],
        totalCount: 0,
        feedback: notFoundClientFeedback(q),
      };
    }

    return {
      ok: true,
      items: merged,
      totalCount: merged.length,
    };
  } catch (e) {
    return lookupFailure(e);
  }
}

export type SubiektResolveSupplierResult =
  | {
      ok: true;
      supplierId: string;
      supplierName: string;
      documentNumber: string | null;
    }
  | { ok: false; feedback: SubiektFeedback };

async function lookupSupplierFromCatalogTwId(
  twId: number,
  appSuppliers: AppSupplierRef[]
): Promise<SubiektResolveSupplierResult> {
  if (!Number.isFinite(twId) || twId <= 0) {
    return {
      ok: false,
      feedback: catalogSupplierUnmappedFeedback({
        message: "Brak ID towaru — wybierz dostawcę ręcznie.",
      }),
    };
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

  if (!links.length) {
    return {
      ok: false,
      feedback: catalogSupplierUnmappedFeedback({
        message:
          "Brak przypisanego dostawcy dla tego produktu — wybierz dostawcę ręcznie (powstanie powiązanie po zapisie).",
      }),
    };
  }

  const scoreSource = (s: string | null) =>
    s === "procurement_verification" ? 3 : s === "order_history" ? 2 : s === "zd_import" ? 1 : 0;
  links.sort((a, b) => {
    const c = (b.orderCount ?? 0) - (a.orderCount ?? 0);
    if (c !== 0) return c;
    return scoreSource(b.lastSource) - scoreSource(a.lastSource);
  });

  const best = links[0]!;

  if (appSuppliers?.length && !appSuppliers.some((s) => s.id === best.supplierId)) {
    return {
      ok: false,
      feedback: catalogSupplierUnmappedFeedback({
        message:
          "Dostawca powiązany z produktem nie jest dostępny na liście — wybierz dostawcę ręcznie.",
      }),
    };
  }

  return {
    ok: true,
    supplierId: best.supplierId,
    supplierName: best.supplierName,
    documentNumber: null,
  };
}

/** Dopasowanie dostawcy po tw_Id z katalogu (np. przy wczytywaniu weryfikacji). */
export async function actionLookupSupplierFromCatalogTwId(
  subiektTwId: number,
  appSuppliers: AppSupplierRef[]
): Promise<SubiektResolveSupplierResult> {
  await requireSubiektLookup();
  try {
    return await lookupSupplierFromCatalogTwId(Math.trunc(subiektTwId), appSuppliers);
  } catch (e) {
    return { ok: false, feedback: feedbackFromException(e) };
  }
}

/** Po wyborze towaru z Subiekta — dostawca z naszej bazy (product_supplier_links), bez przeszukiwania ZD. */
export async function actionSubiektResolveSupplierForProduct(
  product: SubiektProduct,
  appSuppliers: AppSupplierRef[]
): Promise<SubiektResolveSupplierResult> {
  await requireSubiektLookup();
  const twId = Math.trunc(Number((product as { tw_Id?: unknown }).tw_Id));
  if (!Number.isFinite(twId) || twId <= 0) {
    return {
      ok: false,
      feedback: catalogSupplierUnmappedFeedback({
        message: "Brak ID towaru — wybierz dostawcę ręcznie lub zostaw puste.",
      }),
    };
  }
  try {
    return await lookupSupplierFromCatalogTwId(twId, appSuppliers);
  } catch (e) {
    return { ok: false, feedback: feedbackFromException(e) };
  }
}

/** Po wyborze towaru z Subiekta (zakupy) — produkt w katalogu; link tylko gdy podano dostawcę. */
export async function actionRecordCatalogFromSubiektPick(input: {
  subiektTwId: number;
  symbol?: string | null;
  productName?: string | null;
  mikranCode?: string | null;
  supplierId?: string | null;
}): Promise<{ success: true }> {
  await requireOperations("mutate");
  const twId = Math.trunc(Number(input.subiektTwId));
  if (!Number.isFinite(twId) || twId <= 0) {
    throw new Error("Brak ID towaru z Subiekta.");
  }
  await indexOrderLineToProductCatalog({
    orderId: null,
    subiektTwId: twId,
    symbol: input.symbol,
    productName: input.productName,
    mikranCode: input.mikranCode,
    supplierId: input.supplierId?.trim() || null,
    source: "procurement_verification",
    linkSupplier: Boolean(input.supplierId?.trim()),
  });
  return { success: true };
}

async function searchSubiektProductsCombined(
  query: string
): Promise<{ data: SubiektProduct[]; totalCount?: number }> {
  const [symbolSettled, nameSettled] = await Promise.allSettled([
    searchSubiektProducts(productSearchParams(query, "symbol")),
    searchSubiektProducts(productSearchParams(query, "name")),
  ]);

  const symbolData =
    symbolSettled.status === "fulfilled" ? symbolSettled.value.data : [];
  const nameData = nameSettled.status === "fulfilled" ? nameSettled.value.data : [];

  if (
    symbolSettled.status === "rejected" &&
    nameSettled.status === "rejected"
  ) {
    throw symbolSettled.reason;
  }

  const data = mergeSubiektProductSearchResults([symbolData, nameData], 12);
  const totalCount = Math.max(
    symbolSettled.status === "fulfilled"
      ? (symbolSettled.value.pagination?.totalCount ?? 0)
      : 0,
    nameSettled.status === "fulfilled"
      ? (nameSettled.value.pagination?.totalCount ?? 0)
      : 0
  );

  return { data, totalCount: totalCount || undefined };
}

async function suggestProductsForZdLookup(
  query: string
): Promise<SubiektLookupResult<SubiektProduct>> {
  const q = query.trim();
  const field = inferProductZdLookupSearchField(q);
  const minLen = minProductSearchLength(field);
  if (q.length < minLen) return validationFailure("short_query");
  if (!isSubiektConfigured()) {
    return { ok: false, feedback: getSubiektFeedback("not_configured") };
  }

  try {
    const batches: SubiektProduct[][] = [];

    if (looksLikeProductSymbol(q)) {
      const symbolRes = await searchSubiektProducts(productSearchParams(q, "symbol"));
      batches.push(symbolRes.data ?? []);
    }

    if (/^\d{1,12}$/.test(q)) {
      const pluRes = await searchSubiektProducts(productSearchParams(q, "plu"));
      batches.push(filterPluSuggestResultsForZdLookup(pluRes.data ?? [], q));
    }

    if (!looksLikeProductSymbol(q) || batches.every((batch) => !batch.length)) {
      const nameVariants = expandProductNameSearchQueries(q);
      const nameResults = await Promise.allSettled(
        nameVariants.map((variant) =>
          searchSubiektProducts(productSearchParams(variant, "name"))
        )
      );
      for (const settled of nameResults) {
        if (settled.status === "fulfilled" && settled.value.data?.length) {
          batches.push(settled.value.data);
        }
      }
    }

    const rows = rankSubiektProductsForLookupQuery(
      mergeSubiektProductSearchResults(batches, 12),
      q
    );

    if (!rows.length) {
      return {
        ok: true,
        items: [],
        totalCount: 0,
        feedback: notFoundProductFeedback(q),
      };
    }

    return { ok: true, items: rows };
  } catch (e) {
    return lookupFailure(e);
  }
}

async function suggestProducts(
  query: string,
  searchField?: ProductSearchField
): Promise<SubiektLookupResult<SubiektProduct>> {
  const q = query.trim();
  const field = searchField ?? (looksLikeProductSymbol(q) ? "symbol" : "name");
  const minLen = minProductSearchLength(isCombinedProductSearchField(field) ? "name" : field);
  if (q.length < minLen) return validationFailure("short_query");
  if (!isSubiektConfigured()) {
    return { ok: false, feedback: getSubiektFeedback("not_configured") };
  }

  try {
    let rows: SubiektProduct[] = [];
    let totalCount: number | undefined;

    if (isCombinedProductSearchField(field)) {
      const combined = await searchSubiektProductsCombined(q);
      rows = combined.data;
      totalCount = combined.totalCount;
    } else {
      let res = await searchSubiektProducts(productSearchParams(q, field));
      if (field === "plu" && res.data.length > 0) {
        const normalizePlu = (v: unknown): string => {
          const raw = String(v ?? "").trim();
          // Kod Mikran bywa liczbowy; normalizujemy wiodące zera (np. 0896 == 896).
          if (/^\d+$/.test(raw)) return raw.replace(/^0+(?=\d)/, "");
          return raw;
        };
        const qn = normalizePlu(q);
        // W trybie “Kod Mikran” pokazuj tylko wyniki faktycznie po tw_PLU.
        // Subiekt (lub warstwa API) potrafi dorzucić dopasowania po symbolu.
        const onlyPlu = res.data.filter((p) => normalizePlu(p.tw_PLU) === qn);
        if (onlyPlu.length !== res.data.length) {
          res = { ...res, data: onlyPlu };
        }
      }
      if (field === "plu" && res.data.length === 0) {
        const wide = await searchSubiektProducts({
          search: q,
          symbol: q,
          pageSize: 24,
          page: 1,
        });
        const normalizePlu = (v: unknown): string => {
          const raw = String(v ?? "").trim();
          if (/^\d+$/.test(raw)) return raw.replace(/^0+(?=\d)/, "");
          return raw;
        };
        const qn = normalizePlu(q);
        const byPlu = wide.data.filter((p) => normalizePlu(p.tw_PLU) === qn);
        if (byPlu.length) {
          res = { ...res, data: byPlu.slice(0, 12) };
        }
      }
      rows = res.data;
      totalCount = res.pagination?.totalCount;
    }

    if (rows.length === 0) {
      return {
        ok: true,
        items: [],
        totalCount: totalCount ?? 0,
        feedback: notFoundProductFeedback(q),
      };
    }
    return {
      ok: true,
      items: rankSubiektProductsForLookupQuery(rows, q),
      totalCount,
    };
  } catch (e) {
    return lookupFailure(e);
  }
}

export type SubiektSupplierSuggestion = {
  supplierId: string | null;
  label: string;
  detail?: string;
  source: "app" | "subiekt";
};

export type SubiektSupplierSuggestResult =
  | {
      ok: true;
      suggestions: SubiektSupplierSuggestion[];
      feedback?: SubiektFeedback;
      subiektWarning?: SubiektFeedback;
    }
  | { ok: false; feedback: SubiektFeedback };

/** Wyszukiwanie dostawcy — panel admina. */
export async function actionSubiektLookupSupplier(
  query: string
): Promise<SubiektLookupResult<SubiektKontrahent>> {
  // Powiązanie kh_Id jest używane także w module zakupów, więc search nie może być tylko dla admina.
  await requireSupplierManagement();
  const q = query.trim();
  if (!q) return validationFailure("empty_query");
  if (!isSubiektConfigured()) {
    return { ok: false, feedback: getSubiektFeedback("not_configured") };
  }

  try {
    const normalizePhrase = (value: string): string => {
      // Usuń cudzysłowy i “dziwne” znaki, kropki traktuj jak separator.
      const noQuotes = value.replaceAll('"', " ").replaceAll("“", " ").replaceAll("”", " ");
      const noDots = noQuotes.replaceAll(".", " ");
      const cleaned = noDots
        .replace(/[^\p{L}\p{N}\s-]+/gu, " ")
        .replace(/\s+/g, " ")
        .trim();
      return cleaned;
    };

    const buildLookupPhrases = (raw: string): string[] => {
      const base = expandSupplierSearchQueries(raw);
      const extra: string[] = [];
      for (const b of base) {
        const n = normalizePhrase(b);
        if (n && n !== b) extra.push(n);
        // jeśli mamy kilka tokenów (np. PPUH Kos), spróbuj ostatniego (najczęściej nazwa)
        const tokens = n.split(" ").filter(Boolean);
        if (tokens.length >= 2) {
          extra.push(tokens[tokens.length - 1] ?? "");
        }
      }
      return [...new Set([...base, ...extra].map((s) => s.trim()).filter(Boolean))].slice(0, 8);
    };

    // W praktyce kontrahent może nie być oznaczony jako "dostawca" w Subiekcie,
    // a nadal chcemy móc powiązać `kh_Id` w aplikacji. Szukamy więc najpierw w
    // "/kontrahenci/dostawcy", a jeśli nic nie znajdzie, to fallback do "/kontrahenci".
    const queries = buildLookupPhrases(q);
    const merged: SubiektKontrahent[] = [];
    const seenKh = new Set<number>();

    for (const phrase of queries) {
      const [suppliersRes, kontrahenciRes] = await Promise.all([
        searchSubiektSuppliersCached({
          search: phrase,
          pageSize: 24,
          page: 1,
          includeBlocked: true,
        }),
        searchSubiektKontrahenci({
          search: phrase,
          pageSize: 24,
          page: 1,
          includeBlocked: true,
        }),
      ]);

      for (const row of [...(suppliersRes.data ?? []), ...(kontrahenciRes.data ?? [])]) {
        const khId = Number(row.kh_Id);
        if (Number.isFinite(khId)) {
          if (seenKh.has(khId)) continue;
          seenKh.add(khId);
        }
        merged.push(row);
        if (merged.length >= 16) break;
      }
      if (merged.length >= 16) break;
    }

    if (merged.length === 0) {
      return { ok: true, items: [], totalCount: 0, feedback: notFoundSupplierFeedback(q) };
    }

    // Sortuj tak, żeby wyniki zawierające wszystkie tokeny z frazy były na górze.
    const scoreRow = (row: SubiektKontrahent): number => {
      const label = `${row.adr_NazwaPelna ?? ""} ${row.adr_Nazwa ?? ""} ${row.kh_Symbol ?? ""}`.toLowerCase();
      const tokens = normalizePhrase(q)
        .toLowerCase()
        .split(" ")
        .filter((t) => t.length >= 2 && !["ppuh", "pphu", "puh", "sp", "zoo", "s", "a"].includes(t));
      if (!tokens.length) return 0;
      const hits = tokens.filter((t) => label.includes(t)).length;
      // preferuj pełne trafienia
      return hits === tokens.length ? 100 + hits : hits;
    };

    const sorted = [...merged].sort((a, b) => scoreRow(b) - scoreRow(a));
    const top = sorted.slice(0, 40);
    return { ok: true, items: top, totalCount: top.length };
  } catch (e) {
    return lookupFailure(e);
  }
}

/** Podpowiedzi dostawcy — lista app + Subiekt. */
export async function actionSetSupplierSubiektKhId(
  supplierId: string,
  subiektKhId: number | null
): Promise<{ ok: true } | { ok: false; feedback: SubiektFeedback }> {
  await requireSupplierManagement("mutate");

  if (subiektKhId != null && (!Number.isFinite(subiektKhId) || subiektKhId <= 0)) {
    return {
      ok: false,
      feedback: getSubiektFeedback("unknown", {
        message: "Nieprawidłowy identyfikator kontrahenta Subiekt.",
      }),
    };
  }

  const supabase = createAdminClient();

  if (subiektKhId != null) {
    const owner = await findSupplierIdOwningKhId(subiektKhId, supplierId);
    if (owner) {
      return {
        ok: false,
        feedback: getSubiektFeedback("unknown", {
          message: `kh_Id ${subiektKhId} jest już powiązany z innym dostawcą — usuń powiązanie lub dodaj jako dodatkowy kontrahent tam.`,
        }),
      };
    }
    await supabase
      .from("supplier_subiekt_kh_aliases")
      .delete()
      .eq("supplier_id", supplierId)
      .eq("subiekt_kh_id", Math.trunc(subiektKhId));
  }

  const { error } = await supabase
    .from("suppliers")
    .update({
      subiekt_kh_id: subiektKhId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", supplierId);

  if (error) {
    if (error.message?.includes("subiekt_kh_id")) {
      return {
        ok: false,
        feedback: getSubiektFeedback("unknown", {
          message: "Brak kolumny subiekt_kh_id — uruchom migrację 026_supplier_subiekt_kh_id.sql w Supabase.",
        }),
      };
    }
    return {
      ok: false,
      feedback: feedbackFromException(new Error(error.message)),
    };
  }

  revalidateSupplierSubiektKhCaches();

  return { ok: true };
}

function revalidateSupplierSubiektKhCaches() {
  updateTag("app-supplier-refs");
  revalidatePath("/admin/dostawcy");
  revalidatePath("/admin/produkty");
  revalidatePath("/zakupy/dostawcy");
  revalidatePath("/podsumowanie");
  revalidatePath("/prosba");
}

export async function actionListSupplierSubiektKhAliases(
  supplierId: string
): Promise<SupplierSubiektKhAliasRow[]> {
  await requireSupplierManagement();
  return fetchSupplierSubiektKhAliases(supplierId);
}

export async function actionResolveKontrahentLabels(
  khIds: number[]
): Promise<Record<number, string>> {
  await requireSupplierManagement();
  const map = await resolveSubiektKontrahentLabels(khIds);
  return labelsMapToRecord(map);
}

export async function actionAddSupplierSubiektKhAlias(
  supplierId: string,
  subiektKhId: number,
  options?: { note?: string | null; kontrahentLabel?: string | null }
): Promise<{ ok: true } | { ok: false; feedback: SubiektFeedback }> {
  await requireSupplierManagement("mutate");

  const kh = Math.trunc(subiektKhId);
  if (!Number.isFinite(kh) || kh <= 0) {
    return {
      ok: false,
      feedback: getSubiektFeedback("unknown", {
        message: "Nieprawidłowy identyfikator kontrahenta Subiekt.",
      }),
    };
  }

  const supabase = createAdminClient();
  const { data: self } = await supabase
    .from("suppliers")
    .select("subiekt_kh_id")
    .eq("id", supplierId)
    .maybeSingle();
  if (self?.subiekt_kh_id != null && Math.trunc(Number(self.subiekt_kh_id)) === kh) {
    return {
      ok: false,
      feedback: getSubiektFeedback("unknown", {
        message: "Ten kh_Id jest już ustawiony jako główne powiązanie tego dostawcy.",
      }),
    };
  }

  const owner = await findSupplierIdOwningKhId(kh, supplierId);
  if (owner) {
    return {
      ok: false,
      feedback: getSubiektFeedback("unknown", {
        message: `kh_Id ${kh} jest już używany przez innego dostawcę (główne lub dodatkowe powiązanie).`,
      }),
    };
  }

  const trimmedNote = options?.note?.trim() ? options.note.trim().slice(0, 200) : null;
  const trimmedLabel = options?.kontrahentLabel?.trim()
    ? options.kontrahentLabel.trim().slice(0, 300)
    : null;
  const { error } = await supabase.from("supplier_subiekt_kh_aliases").insert({
    supplier_id: supplierId,
    subiekt_kh_id: kh,
    subiekt_label: trimmedLabel,
    note: trimmedNote,
  });

  if (error) {
    if (error.code === "23505" || error.message.includes("unique")) {
      return {
        ok: false,
        feedback: getSubiektFeedback("unknown", {
          message: `kh_Id ${kh} jest już przypisany (unikalność w bazie).`,
        }),
      };
    }
    if (error.message.includes("supplier_subiekt_kh_aliases")) {
      return {
        ok: false,
        feedback: getSubiektFeedback("unknown", {
          message:
            "Brak tabeli supplier_subiekt_kh_aliases — uruchom migrację 040_supplier_subiekt_kh_aliases.sql w Supabase.",
        }),
      };
    }
    return {
      ok: false,
      feedback: feedbackFromException(new Error(error.message)),
    };
  }

  revalidateSupplierSubiektKhCaches();
  return { ok: true };
}

export async function actionRemoveSupplierSubiektKhAlias(
  supplierId: string,
  subiektKhId: number
): Promise<{ ok: true } | { ok: false; feedback: SubiektFeedback }> {
  await requireSupplierManagement("mutate");

  const kh = Math.trunc(subiektKhId);
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("supplier_subiekt_kh_aliases")
    .delete()
    .eq("supplier_id", supplierId)
    .eq("subiekt_kh_id", kh);

  if (error) {
    return {
      ok: false,
      feedback: feedbackFromException(new Error(error.message)),
    };
  }

  revalidateSupplierSubiektKhCaches();
  return { ok: true };
}

/**
 * Podpowiedzi z Subiekta (dopasowania i brak w bazie).
 * Lista „W systemie” filtruje klient — bez wysyłania całej bazy na serwer.
 */
export async function actionSubiektSuggestSuppliers(
  query: string
): Promise<SubiektSupplierSuggestResult> {
  await requireSubiektLookup();
  const trimmed = query.trim();
  const q = trimmed.toLowerCase();
  if (q.length < 2) {
    return { ok: true, suggestions: [] };
  }

  if (!isSubiektConfigured()) {
    return { ok: true, suggestions: [] };
  }

  const reachable = await isSubiektReachable();
  if (!reachable) {
    return {
      ok: true,
      suggestions: [],
      subiektWarning: getSubiektFeedback("subiekt_unavailable", {
        hint: "Wyszukiwanie w systemie działa — Subiekt jest offline.",
      }),
    };
  }

  try {
    const appSuppliers = await getAppSupplierRefsCached();
    const queries = expandSupplierSearchQueries(trimmed);
    const mergedKontrahenci: SubiektKontrahent[] = [];
    const seenKh = new Set<number>();

    for (const searchPhrase of queries) {
      const res = await searchSubiektSuppliersCached({
        search: searchPhrase,
        pageSize: 8,
        page: 1,
      });
      for (const k of res.data) {
        const khId = k.kh_Id;
        if (khId != null && Number.isFinite(khId)) {
          if (seenKh.has(khId)) continue;
          seenKh.add(khId);
        }
        mergedKontrahenci.push(k);
        if (mergedKontrahenci.length >= 12) break;
      }
      if (mergedKontrahenci.length >= 12) break;
    }

    const subiektSuggestions: SubiektSupplierSuggestion[] = [];
    const seenIds = new Set<string>();

    for (const k of mergedKontrahenci) {
      const matchedId = matchSubiektKontrahentToSupplier(k, appSuppliers);
      if (matchedId && !seenIds.has(matchedId)) {
        seenIds.add(matchedId);
        const appName = appSuppliers.find((s) => s.id === matchedId)?.name;
        subiektSuggestions.push({
          supplierId: matchedId,
          label: appName ?? formatSubiektKontrahentLabel(k),
          detail: "Dopasowano z Subiekta",
          source: "subiekt",
        });
      } else if (!matchedId) {
        subiektSuggestions.push({
          supplierId: null,
          label: formatSubiektKontrahentLabel(k),
          detail: "Brak w bazie aplikacji — wybierz ręcznie lub zostaw puste",
          source: "subiekt",
        });
      }
    }

    const feedback =
      subiektSuggestions.length === 0 && mergedKontrahenci.length === 0
        ? notFoundSupplierFeedback(trimmed)
        : undefined;

    return { ok: true, suggestions: subiektSuggestions, feedback };
  } catch (e) {
    return { ok: false, feedback: feedbackFromException(e) };
  }
}

/** Stan magazynowy pozycji prośby (batch po tw_Id). */
export async function actionFetchProsbaLineStock(
  twIds: number[]
): Promise<Record<number, ProsbaLineStockSnapshot>> {
  await requireSubiektLookup();
  return fetchProsbaLineStock(twIds);
}
