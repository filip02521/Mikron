import { getSubiektDocument, searchSubiektZd } from "@/lib/subiekt/api";
import { isSubiektReachable } from "@/lib/subiekt/availability";
import {
  formatSubiektKontrahentLabel,
  matchSubiektKontrahentToSupplier,
  type AppSupplierRef,
} from "@/lib/subiekt/match-supplier";
import { zdSearchPlansForProduct } from "@/lib/subiekt/zd-search-for-product";
import type {
  SubiektDocument,
  SubiektDocumentLine,
  SubiektKontrahent,
  SubiektProduct,
} from "@/lib/subiekt/types";
import { zdLineMatchesOrder } from "@/lib/subiekt/zd-eta";

export type ResolvedProductSupplier = {
  supplierId: string;
  supplierName: string;
  subiektLabel: string;
  documentNumber: string | null;
};

export type UnmappedProductSupplier = {
  subiektLabel: string;
  documentNumber: string | null;
};

/** Maks. ZD na jedną frazę wyszukiwania (żeby „Viva” nie zjadło limitu przed „Flex”). */
const MAX_ZD_PER_SEARCH_PLAN = 5;
/** Łączny limit detali ZD na jeden wybór towaru. */
const MAX_ZD_DETAIL_FETCH_TOTAL = 18;

function kontrahentFromDoc(doc: SubiektDocument): SubiektKontrahent | null {
  return doc.kh__Kontrahent_Odbiorca ?? doc.kh__Kontrahent_Platnik ?? null;
}

function lineMatchesProduct(
  product: SubiektProduct,
  symbol: string,
  productName: string,
  line: SubiektDocumentLine
): boolean {
  const towId = product.tw_Id;
  const lineTowId = line.ob_TowId;
  if (
    towId != null &&
    lineTowId != null &&
    Number(lineTowId) === Number(towId)
  ) {
    return true;
  }
  return zdLineMatchesOrder(line, symbol, productName) !== null;
}

type ScanResult = {
  kontrahent: SubiektKontrahent;
  documentNumber: string | null;
};

/** Przeszukuje ZD (wiele fraz z nazwy) i zatrzymuje się na pierwszej pasującej pozycji. */
async function scanProductInZdDocuments(
  product: SubiektProduct
): Promise<ScanResult | null> {
  const symbol = (product.tw_Symbol ?? "").trim();
  const name = (product.tw_Nazwa ?? "").trim();
  const plans = zdSearchPlansForProduct(product);
  const seen = new Set<number>();
  let fetchedTotal = 0;

  for (const plan of plans) {
    let list;
    try {
      list = await searchSubiektZd(plan);
    } catch {
      continue;
    }

    if (!list.data.length || (list.pagination?.totalCount ?? 0) === 0) {
      continue;
    }

    let fetchedThisPlan = 0;

    for (const brief of list.data) {
      if (fetchedThisPlan >= MAX_ZD_PER_SEARCH_PLAN) break;
      if (fetchedTotal >= MAX_ZD_DETAIL_FETCH_TOTAL) return null;

      if (seen.has(brief.dok_Id)) continue;
      seen.add(brief.dok_Id);
      fetchedThisPlan++;
      fetchedTotal++;

      let doc: SubiektDocument;
      try {
        doc = await getSubiektDocument(brief.dok_Id);
      } catch {
        continue;
      }

      const lines = doc.dok_Pozycja ?? [];
      if (!lines.some((line) => lineMatchesProduct(product, symbol, name, line))) {
        continue;
      }

      const kontrahent = kontrahentFromDoc(doc);
      if (!kontrahent) continue;

      return {
        kontrahent,
        documentNumber: doc.dok_NrPelny?.trim() ?? null,
      };
    }
  }

  return null;
}

export type ProductSupplierLookup =
  | { status: "not_found" }
  | {
      status: "mapped";
      supplierId: string;
      supplierName: string;
      subiektLabel: string;
      documentNumber: string | null;
    }
  | {
      status: "unmapped";
      subiektLabel: string;
      documentNumber: string | null;
    };

/** Jedno przejście po ZD — mapowany dostawca, tylko Subiekt, lub brak ZD. */
export async function lookupSupplierForSubiektProduct(
  product: SubiektProduct,
  appSuppliers: AppSupplierRef[]
): Promise<ProductSupplierLookup> {
  if (!(await isSubiektReachable())) return { status: "not_found" };

  const symbol = (product.tw_Symbol ?? "").trim();
  const name = (product.tw_Nazwa ?? "").trim();
  if (!symbol && !name) return { status: "not_found" };

  const hit = await scanProductInZdDocuments(product);
  if (!hit) return { status: "not_found" };

  const subiektLabel = formatSubiektKontrahentLabel(hit.kontrahent);
  const supplierId = matchSubiektKontrahentToSupplier(hit.kontrahent, appSuppliers);

  if (supplierId) {
    const supplierName =
      appSuppliers.find((s) => s.id === supplierId)?.name ?? subiektLabel;
    return {
      status: "mapped",
      supplierId,
      supplierName,
      subiektLabel,
      documentNumber: hit.documentNumber,
    };
  }

  return {
    status: "unmapped",
    subiektLabel,
    documentNumber: hit.documentNumber,
  };
}

/** Ostatnie ZD z tą pozycją → kontrahent → dostawca w aplikacji. */
export async function resolveSupplierForSubiektProduct(
  product: SubiektProduct,
  appSuppliers: AppSupplierRef[]
): Promise<ResolvedProductSupplier | null> {
  if (!appSuppliers.length) return null;
  const lookup = await lookupSupplierForSubiektProduct(product, appSuppliers);
  if (lookup.status !== "mapped") return null;
  return {
    supplierId: lookup.supplierId,
    supplierName: lookup.supplierName,
    subiektLabel: lookup.subiektLabel,
    documentNumber: lookup.documentNumber,
  };
}

/** Znaleziono ZD, ale brak dopasowania do listy dostawców w aplikacji. */
export async function findUnmappedSubiektSupplierForProduct(
  product: SubiektProduct,
  appSuppliers: AppSupplierRef[]
): Promise<UnmappedProductSupplier | null> {
  const lookup = await lookupSupplierForSubiektProduct(product, appSuppliers);
  if (lookup.status !== "unmapped") return null;
  return {
    subiektLabel: lookup.subiektLabel,
    documentNumber: lookup.documentNumber,
  };
}
