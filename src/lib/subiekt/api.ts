import { subiektFetch, subiektJson } from "@/lib/subiekt/client";
import { resolveSubiektOrdersConfig } from "@/lib/subiekt/config";
import { SubiektRequestError } from "@/lib/subiekt/errors";
import { SUBIEKT_PATHS } from "@/lib/subiekt/paths";
import { subiektQueryString } from "@/lib/subiekt/query";
import type { SubiektConfig } from "@/lib/subiekt/config";
import type {
  SubiektCreateZdInput,
  SubiektDocument,
  SubiektHealthData,
  SubiektKontrahent,
  SubiektListEnvelope,
  SubiektListParams,
  SubiektProduct,
  SubiektProductCecha,
  SubiektProductGroup,
  SubiektRemanentEnvelope,
  SubiektRemanentParams,
  SubiektPanstwo,
  SubiektSingleEnvelope,
  SubiektZdEstimateData,
  SubiektZdEstimateLine,
  SubiektZdEstimateParamsInput,
  SubiektZdEstimateZkData,
  SubiektZdEstimateZkParamsInput,
} from "@/lib/subiekt/types";

/** Timeout Sfery przy tworzeniu ZD (strona szacunku ma maxDuration=180). */
export const SUBIEKT_ORDERS_ZD_CREATE_TIMEOUT_MS = 180_000;
import {
  ZD_ESTIMATE_MAX_PAGES,
  ZD_ESTIMATE_PAGE_FETCH_CONCURRENCY,
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

export async function searchSubiektFs(
  params: Omit<SubiektListParams, "typ"> = {}
): Promise<SubiektListEnvelope<SubiektDocument>> {
  return subiektList<SubiektDocument>(SUBIEKT_PATHS.documentsFs, params);
}

export async function getSubiektFs(id: number | string): Promise<SubiektDocument> {
  const res = await subiektGet<SubiektDocument>(SUBIEKT_PATHS.documentFs(id));
  return res.data;
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
 * Data ostatniej FS na hoście ORDERS (live/test) — yyyy-mm-dd.
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
    const [lastWide, recent] = await Promise.all([
      totalPages > 1
        ? fetchFsPage(wideOd, totalPages, 100)
        : Promise.resolve({ data: [] as Array<{ dok_DataWyst?: string | null }> }),
      fetchFsPage(recentOd, 1, 100),
    ]);
    collected.push(...(lastWide.data ?? []));
    collected.push(...(recent.data ?? []));

    return pickLatestFsDateKey(collected);
  } catch {
    return null;
  }
}

/** Lista grup towarowych — GET /groups (host ORDERS). */
export async function searchSubiektProductGroups(
  params: SubiektListParams = {}
): Promise<SubiektListEnvelope<SubiektProductGroup>> {
  return subiektList<SubiektProductGroup>(
    SUBIEKT_PATHS.groups,
    params,
    ordersConfigOrThrow()
  );
}

/** Słownik cech towarów — GET /cechy/towarow (host ORDERS). */
export async function searchSubiektProductCechy(
  params: SubiektListParams = {}
): Promise<SubiektListEnvelope<SubiektProductCecha>> {
  return subiektList<SubiektProductCecha>(
    SUBIEKT_PATHS.cechyTowarow,
    params,
    ordersConfigOrThrow()
  );
}

/** Jedna strona kreatora ZD — GET /orders/zd/estimate. */
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
    cechaId: params.cechaId,
    towarId: params.towarId,
    tylkoBraki: params.tylkoBraki,
    page: params.page,
    pageSize: params.pageSize,
  });
  return subiektJson(`${SUBIEKT_PATHS.ordersZdEstimate}${qs}`, {}, config);
}

/** Jedna strona rozbicia otwartych ZK towaru — GET /orders/zd/estimate/zk. */
export async function fetchSubiektZdEstimateZkPage(
  params: SubiektZdEstimateZkParamsInput
): Promise<{
  data: SubiektZdEstimateZkData;
  pagination?: SubiektListEnvelope<unknown>["pagination"];
}> {
  const config = ordersConfigOrThrow();
  const towarId = Math.trunc(Number(params.towarId));
  if (!Number.isFinite(towarId) || towarId <= 0) {
    throw new Error("Nieprawidłowy identyfikator towaru.");
  }
  const qs = subiektQueryString({
    towarId,
    tylkoBezRez: params.tylkoBezRez,
    dataOd: params.dataOd,
    dataDo: params.dataDo,
    okres: params.okres,
    dniZapasu: params.dniZapasu,
    zapasMin: params.zapasMin,
    zdDataOd: params.zdDataOd,
    zdDataDo: params.zdDataDo,
    zdOkres: params.zdOkres,
    page: params.page,
    pageSize: params.pageSize,
  });
  return subiektJson(`${SUBIEKT_PATHS.ordersZdEstimateZk}${qs}`, {}, config);
}

/** Lista towarów na hoście ORDERS (np. filtr cechaId). */
export async function searchSubiektOrdersProducts(
  params: SubiektListParams = {}
): Promise<SubiektListEnvelope<SubiektProduct>> {
  return subiektList<SubiektProduct>(
    SUBIEKT_PATHS.products,
    params,
    ordersConfigOrThrow()
  );
}

/**
 * Remanent na dzień — host ORDERS (`GET /products/remanent`).
 * `tw_Stan` w `/products` to stan bieżący; tu ilość z `dok_MagRuch` na `naDzien`.
 */
export async function searchSubiektOrdersProductsRemanent(
  params: SubiektRemanentParams = {}
): Promise<SubiektRemanentEnvelope> {
  const qs = subiektQueryString({
    naDzien: params.naDzien,
    magazynId: params.magazynId,
    grupaId: params.grupaId,
    cechaId: params.cechaId,
    towarId: params.towarId,
    grupujPoCenie: params.grupujPoCenie,
    rozbicieDostaw: params.rozbicieDostaw,
    tylkoZIloscia: params.tylkoZIloscia,
    page: params.page,
    pageSize: params.pageSize,
  });
  return subiektJson<SubiektRemanentEnvelope>(
    `${SUBIEKT_PATHS.productsRemanent}${qs}`,
    {},
    ordersConfigOrThrow()
  );
}

/** Słownik państw — host ORDERS (`GET /kraje`). */
export async function fetchSubiektOrdersKraje(): Promise<SubiektPanstwo[]> {
  const res = await subiektJson<{ data: SubiektPanstwo[] }>(
    SUBIEKT_PATHS.kraje,
    {},
    ordersConfigOrThrow()
  );
  return Array.isArray(res.data) ? res.data : [];
}

/** Lista FS na hoście ORDERS — nagłówki (pozycje dopiero w GET szczegółu). */
export async function searchSubiektOrdersFs(
  params: Omit<SubiektListParams, "typ"> = {}
): Promise<SubiektListEnvelope<SubiektDocument>> {
  return subiektList<SubiektDocument>(
    SUBIEKT_PATHS.documentsFs,
    params,
    ordersConfigOrThrow()
  );
}

/** Pełna FS (z liniami) na hoście ORDERS. */
export async function getSubiektOrdersFs(
  id: number | string
): Promise<SubiektDocument> {
  const res = await subiektGet<SubiektDocument>(
    SUBIEKT_PATHS.documentFs(id),
    ordersConfigOrThrow()
  );
  return res.data;
}

/** Lista ZD na hoście ORDERS — do powiązania ze szacunkiem. */
export async function searchSubiektOrdersZd(
  params: Omit<SubiektListParams, "typ"> = {}
): Promise<SubiektListEnvelope<SubiektDocument>> {
  return subiektList<SubiektDocument>(
    SUBIEKT_PATHS.documentsZd,
    params,
    ordersConfigOrThrow()
  );
}

/** Pełne ZD (z liniami) na hoście ORDERS. */
export async function getSubiektOrdersZd(
  id: number | string
): Promise<SubiektDocument> {
  const res = await subiektGet<SubiektDocument>(
    SUBIEKT_PATHS.documentZd(id),
    ordersConfigOrThrow()
  );
  return res.data;
}

/**
 * Tworzy ZD przez Sferę na hoście ORDERS (`POST /documents/zd/create`).
 * Timeout 180s — na live zapisuje dokument w aktualnej bazie.
 */
export async function createSubiektOrdersZd(
  body: SubiektCreateZdInput
): Promise<SubiektDocument> {
  const base = ordersConfigOrThrow();
  const config: SubiektConfig = {
    ...base,
    timeoutMs: SUBIEKT_ORDERS_ZD_CREATE_TIMEOUT_MS,
  };
  const res = await subiektFetch(
    SUBIEKT_PATHS.documentsZdCreate,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
    config
  );
  const text = await res.text();
  if (!res.ok) {
    // Pełne body (nie snippet) — Sfera/validation zwracają JSON z code/error.
    throw new SubiektRequestError(res.status, text || res.statusText);
  }
  if (!text) {
    throw new Error("Subiekt create ZD: pusta odpowiedź.");
  }
  let parsed: SubiektSingleEnvelope<SubiektDocument>;
  try {
    parsed = JSON.parse(text) as SubiektSingleEnvelope<SubiektDocument>;
  } catch {
    throw new SubiektRequestError(res.status, "Odpowiedź create ZD nie jest JSON");
  }
  if (!parsed.data?.dok_Id) {
    throw new Error("Subiekt create ZD: brak dok_Id w odpowiedzi.");
  }
  return parsed.data;
}

/**
 * Pobiera wszystkie strony estimate dla zakresu (grupa / cecha / towar)
 * z hosta ORDERS (live :5080 lub test :5082).
 * Domyślnie tylkoBraki=false — pełna lista towarów zakresu z Subiekta (jak informator).
 *
 * `validateFirstPage` — zaraz po 1. stronie, przed paginacją (np. echo filtra:
 * bez tego stary API mógłby dociągnąć cały katalog).
 */
export class SubiektZdEstimateFirstPageRejectedError extends Error {
  readonly title: string;

  constructor(title: string, message: string) {
    super(message);
    this.name = "SubiektZdEstimateFirstPageRejectedError";
    this.title = title;
  }
}

export async function fetchSubiektZdEstimateAll(
  params: Omit<SubiektZdEstimateParamsInput, "page" | "pageSize"> & {
    pageSize?: number;
    maxPages?: number;
  },
  options?: {
    validateFirstPage?: (input: {
      parametry: SubiektZdEstimateData["parametry"];
      pozycje: SubiektZdEstimateLine[];
      totalCountApi: number;
    }) => { ok: true } | { ok: false; title: string; message: string };
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

  if (options?.validateFirstPage) {
    const gate = options.validateFirstPage({
      parametry: data.parametry ?? {},
      pozycje,
      totalCountApi,
    });
    if (!gate.ok) {
      throw new SubiektZdEstimateFirstPageRejectedError(
        gate.title,
        gate.message
      );
    }
  }

  const pagesToFetch = Math.min(totalPages, maxPages);
  let pagesFetched = 1;
  let stoppedEarly = false;

  if (pagesToFetch > 1) {
    // Pipeline z limitem współbieżności: commitujemy strony po kolei.
    // Po pierwszej pustej nie claimujemy kolejnych (mniej zbędnego I/O niż fala „wszystkie naraz”).
    const concurrency = ZD_ESTIMATE_PAGE_FETCH_CONCURRENCY;
    let nextClaim = 2;
    let nextCommit = 2;
    let haltClaim = false;
    const buffer = new Map<number, SubiektZdEstimateLine[] | null | undefined>();

    const workers = Array.from({ length: concurrency }, async () => {
      while (true) {
        if (haltClaim) return;
        const page = nextClaim;
        if (page > pagesToFetch) return;
        nextClaim += 1;

        const next = await fetchSubiektZdEstimatePage({
          ...params,
          tylkoBraki,
          page,
          pageSize,
        });
        buffer.set(page, next.data?.pozycje);

        while (buffer.has(nextCommit)) {
          const batch = buffer.get(nextCommit);
          buffer.delete(nextCommit);
          if (!Array.isArray(batch) || batch.length === 0) {
            stoppedEarly = true;
            haltClaim = true;
            return;
          }
          pozycje.push(...batch);
          pagesFetched = nextCommit;
          nextCommit += 1;
        }
      }
    });

    await Promise.all(workers);
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

export type SubiektProductKompletRow = {
  kpl_Id: number;
  kompletTwId: number;
  skladnikTwId: number;
  liczba: number;
  kompletSymbol?: string | null;
  skladnikSymbol?: string | null;
};

/** GET /products/komplety — wymaga wdrożenia na hoście ORDERS. */
export async function searchSubiektProductKomplety(
  params: {
    kompletId?: number;
    skladnikId?: number;
    page?: number;
    pageSize?: number;
  } = {}
): Promise<SubiektListEnvelope<SubiektProductKompletRow>> {
  const config = ordersConfigOrThrow();
  const qs = subiektQueryString({
    kompletId: params.kompletId,
    skladnikId: params.skladnikId,
    page: params.page,
    pageSize: params.pageSize,
  });
  return subiektJson(
    `${SUBIEKT_PATHS.productsKomplety}${qs}`,
    {},
    config
  );
}
