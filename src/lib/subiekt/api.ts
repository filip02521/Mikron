import { subiektJson } from "@/lib/subiekt/client";
import { resolveSubiektOrdersConfig } from "@/lib/subiekt/config";
import { SUBIEKT_PATHS } from "@/lib/subiekt/paths";
import { subiektQueryString } from "@/lib/subiekt/query";
import type { SubiektConfig } from "@/lib/subiekt/config";
import type {
  SubiektDocument,
  SubiektHealthData,
  SubiektKontrahent,
  SubiektListEnvelope,
  SubiektListParams,
  SubiektProduct,
  SubiektProductGroup,
  SubiektSingleEnvelope,
  SubiektZdEstimateData,
  SubiektZdEstimateLine,
  SubiektZdEstimateParamsInput,
} from "@/lib/subiekt/types";
import {
  ZD_ESTIMATE_MAX_PAGES,
  ZD_ESTIMATE_PAGE_SIZE,
} from "@/lib/orders/zd-estimate-manual";
import {
  isZdEstimateFetchIncomplete,
  pickLatestFsDateKey,
} from "@/lib/orders/zd-estimate-bulk";
import { warsawDateKeyDaysAgo, warsawNowParts } from "@/lib/time/warsaw";

export type { SubiektListParams };

async function subiektList<T>(
  path: string,
  params: SubiektListParams = {},
  config?: SubiektConfig | null
): Promise<SubiektListEnvelope<T>> {
  const qs = subiektQueryString(params as Record<string, string | number | boolean | undefined>);
  return subiektJson<SubiektListEnvelope<T>>(`${path}${qs}`, {}, config);
}

async function subiektGet<T>(
  path: string,
  config?: SubiektConfig | null
): Promise<SubiektSingleEnvelope<T>> {
  return subiektJson<SubiektSingleEnvelope<T>>(path, {}, config);
}

export async function fetchSubiektHealth(): Promise<SubiektHealthData> {
  const res = await subiektJson<SubiektSingleEnvelope<SubiektHealthData>>(SUBIEKT_PATHS.health);
  return res.data;
}

export async function searchSubiektProducts(
  params: SubiektListParams = {}
): Promise<SubiektListEnvelope<SubiektProduct>> {
  return subiektList<SubiektProduct>(SUBIEKT_PATHS.products, params);
}

export async function getSubiektProduct(
  id: number | string
): Promise<SubiektProduct> {
  const res = await subiektGet<SubiektProduct>(SUBIEKT_PATHS.product(id));
  return res.data;
}

export async function searchSubiektSuppliers(
  params: SubiektListParams = {}
): Promise<SubiektListEnvelope<SubiektKontrahent>> {
  return subiektList<SubiektKontrahent>(SUBIEKT_PATHS.dostawcy, params);
}

export async function searchSubiektCustomers(
  params: SubiektListParams = {}
): Promise<SubiektListEnvelope<SubiektKontrahent>> {
  return subiektList<SubiektKontrahent>(SUBIEKT_PATHS.odbiorcy, params);
}

export async function searchSubiektKontrahenci(
  params: SubiektListParams = {}
): Promise<SubiektListEnvelope<SubiektKontrahent>> {
  return subiektList<SubiektKontrahent>(SUBIEKT_PATHS.kontrahenci, params);
}

export async function getSubiektKontrahent(
  id: number | string
): Promise<SubiektKontrahent> {
  const res = await subiektGet<SubiektKontrahent>(SUBIEKT_PATHS.kontrahent(id));
  return res.data;
}

export async function searchSubiektDocuments(
  params: SubiektListParams = {}
): Promise<SubiektListEnvelope<SubiektDocument>> {
  return subiektList<SubiektDocument>(SUBIEKT_PATHS.documents, params);
}

export async function searchSubiektZk(
  params: Omit<SubiektListParams, "typ"> = {}
): Promise<SubiektListEnvelope<SubiektDocument>> {
  return subiektList<SubiektDocument>(SUBIEKT_PATHS.documentsZk, params);
}

export async function searchSubiektZd(
  params: Omit<SubiektListParams, "typ"> = {}
): Promise<SubiektListEnvelope<SubiektDocument>> {
  return subiektList<SubiektDocument>(SUBIEKT_PATHS.documentsZd, params);
}

export async function getSubiektDocument(
  id: number | string
): Promise<SubiektDocument> {
  const res = await subiektGet<SubiektDocument>(SUBIEKT_PATHS.document(id));
  return res.data;
}

export async function getSubiektZk(
  id: number | string
): Promise<SubiektDocument> {
  const res = await subiektGet<SubiektDocument>(SUBIEKT_PATHS.documentZk(id));
  return res.data;
}

export async function getSubiektZd(
  id: number | string
): Promise<SubiektDocument> {
  const res = await subiektGet<SubiektDocument>(SUBIEKT_PATHS.documentZd(id));
  return res.data;
}

function ordersConfigOrThrow(): SubiektConfig {
  const resolved = resolveSubiektOrdersConfig();
  if (!resolved.ok) {
    throw new Error(resolved.message);
  }
  return resolved.config;
}

/**
 * Data ostatniej FS na hoście testowym (ORDERS) — yyyy-mm-dd.
 * Używane jako dataDo okna sprzedaży (kopia bywa starsza niż „dziś”).
 *
 * API nie gwarantuje sortu — bierzemy MAX(dok_DataWyst) z:
 * - strony 1 i ostatniej w oknie ~18 mies. (ASC vs DESC),
 * - strony 1 w oknie ostatnich 90 dni (świeże FS).
 */
export async function fetchSubiektOrdersLatestFsDateKey(): Promise<string | null> {
  const resolved = resolveSubiektOrdersConfig();
  if (!resolved.ok) return null;
  try {
    const dataDo = warsawNowParts().dateKey;
    const wideOd = warsawDateKeyDaysAgo(550);
    const recentOd = warsawDateKeyDaysAgo(90);
    const collected: Array<{ dok_DataWyst?: string | null }> = [];

    const fetchFsPage = async (
      dataOd: string,
      page: number,
      pageSize: number
    ) => {
      const qs = subiektQueryString({ page, pageSize, dataOd, dataDo });
      return subiektJson<{
        data?: Array<{ dok_DataWyst?: string | null }>;
        pagination?: { totalPages?: number };
      }>(`${SUBIEKT_PATHS.documentsFs}${qs}`, {}, resolved.config);
    };

    const firstWide = await fetchFsPage(wideOd, 1, 100);
    collected.push(...(firstWide.data ?? []));
    const totalPages = Math.max(1, firstWide.pagination?.totalPages ?? 1);
    if (totalPages > 1) {
      const lastWide = await fetchFsPage(wideOd, totalPages, 100);
      collected.push(...(lastWide.data ?? []));
    }

    const recent = await fetchFsPage(recentOd, 1, 100);
    collected.push(...(recent.data ?? []));

    return pickLatestFsDateKey(collected);
  } catch {
    return null;
  }
}

/** Lista grup towarowych — GET /groups (host orders / test :5082). */
export async function searchSubiektProductGroups(
  params: SubiektListParams = {}
): Promise<SubiektListEnvelope<SubiektProductGroup>> {
  return subiektList<SubiektProductGroup>(
    SUBIEKT_PATHS.groups,
    params,
    ordersConfigOrThrow()
  );
}

/** Jedna strona szacunku ZD — GET /orders/zd/estimate. */
export async function fetchSubiektZdEstimatePage(
  params: SubiektZdEstimateParamsInput = {}
): Promise<{
  data: SubiektZdEstimateData;
  pagination?: SubiektListEnvelope<unknown>["pagination"];
}> {
  const config = ordersConfigOrThrow();
  const qs = subiektQueryString({
    dataOd: params.dataOd,
    dataDo: params.dataDo,
    dniZapasu: params.dniZapasu,
    zapasMin: params.zapasMin,
    grupaId: params.grupaId,
    towarId: params.towarId,
    tylkoBraki: params.tylkoBraki,
    page: params.page,
    pageSize: params.pageSize,
  });
  return subiektJson(`${SUBIEKT_PATHS.ordersZdEstimate}${qs}`, {}, config);
}

/**
 * Pobiera wszystkie strony estimate dla grupy/towaru z hosta testowego (:5082).
 * Domyślnie tylkoBraki=false — pełna lista towarów grupy z Subiekta (jak informator).
 */
export async function fetchSubiektZdEstimateAll(
  params: Omit<SubiektZdEstimateParamsInput, "page" | "pageSize"> & {
    pageSize?: number;
    maxPages?: number;
  }
): Promise<{
  parametry: SubiektZdEstimateData["parametry"];
  pozycje: SubiektZdEstimateLine[];
  pagesFetched: number;
  totalCountApi: number;
  truncated: boolean;
}> {
  const pageSize = Math.min(
    Math.max(1, params.pageSize ?? ZD_ESTIMATE_PAGE_SIZE),
    200
  );
  const maxPages = Math.max(1, params.maxPages ?? ZD_ESTIMATE_MAX_PAGES);
  const tylkoBraki = params.tylkoBraki ?? false;

  const first = await fetchSubiektZdEstimatePage({
    ...params,
    tylkoBraki,
    page: 1,
    pageSize,
  });

  const data = first.data;
  if (!data || !Array.isArray(data.pozycje)) {
    throw new Error("Niepoprawna odpowiedź /orders/zd/estimate — brak pozycji.");
  }

  const pozycje: SubiektZdEstimateLine[] = [...data.pozycje];
  const totalPages = Math.max(1, first.pagination?.totalPages ?? 1);
  const totalCountApi = first.pagination?.totalCount ?? pozycje.length;
  const pagesToFetch = Math.min(totalPages, maxPages);
  let pagesFetched = 1;
  let stoppedEarly = false;

  for (let page = 2; page <= pagesToFetch; page++) {
    const next = await fetchSubiektZdEstimatePage({
      ...params,
      tylkoBraki,
      page,
      pageSize,
    });
    const batch = next.data?.pozycje;
    if (!Array.isArray(batch) || batch.length === 0) {
      stoppedEarly = true;
      break;
    }
    pozycje.push(...batch);
    pagesFetched = page;
  }

  return {
    parametry: data.parametry ?? {},
    pozycje,
    pagesFetched,
    totalCountApi,
    truncated: isZdEstimateFetchIncomplete({
      pagesFetched,
      totalPages,
      maxPages,
      pozycjeCount: pozycje.length,
      totalCountApi,
      stoppedEarly,
    }),
  };
}
