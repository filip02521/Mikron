import { subiektJson } from "@/lib/subiekt/client";
import { SUBIEKT_PATHS } from "@/lib/subiekt/paths";
import { subiektQueryString } from "@/lib/subiekt/query";
import type {
  SubiektDocument,
  SubiektHealthData,
  SubiektKontrahent,
  SubiektListEnvelope,
  SubiektProduct,
  SubiektSingleEnvelope,
} from "@/lib/subiekt/types";

export type SubiektListParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  symbol?: string;
  email?: string;
  id?: number | string;
  /** Towar — tw_PLU (Kod Mikran). */
  plu?: string;
  /** Kontrahent (kh_Id) — działa razem z `search` na GET /documents/zd. */
  khId?: number;
  name?: string;
  limit?: number;
  typ?: number;
  dataOd?: string;
  dataDo?: string;
  includeBlocked?: boolean;
};

async function subiektList<T>(
  path: string,
  params: SubiektListParams = {}
): Promise<SubiektListEnvelope<T>> {
  const qs = subiektQueryString(params as Record<string, string | number | boolean | undefined>);
  return subiektJson<SubiektListEnvelope<T>>(`${path}${qs}`);
}

async function subiektGet<T>(path: string): Promise<SubiektSingleEnvelope<T>> {
  return subiektJson<SubiektSingleEnvelope<T>>(path);
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
