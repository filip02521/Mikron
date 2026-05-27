import {
  defaultZdSearchDataOd,
  getSubiektDocumentCached,
  searchSubiektZdCached,
} from "@/lib/subiekt/subiekt-runtime-cache";
import { isSubiektReachable } from "@/lib/subiekt/availability";
import { dedupeAppSuppliersByKhId } from "@/lib/subiekt/dedupe-suppliers-by-kh";
import {
  formatSubiektKontrahentLabel,
  matchSubiektKontrahentToSupplier,
  type AppSupplierRef,
} from "@/lib/subiekt/match-supplier";
import { zdSearchPlansForProductSupplierLookup, effectiveProductSymbol } from "@/lib/subiekt/zd-search-for-product";
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
const MAX_ZD_PER_SEARCH_PLAN = 6;
/** Łączny limit detali ZD na jeden wybór towaru. */
const MAX_ZD_DETAIL_FETCH_TOTAL = 24;
/** Równoległe pobieranie detali ZD — szybsze bez nadmiernego obciążenia API. */
const ZD_DETAIL_FETCH_CONCURRENCY = 3;

const MS_PER_DAY = 86_400_000;
const DATA_OD_DAYS_PRIMARY = 180;
const DATA_OD_DAYS_FALLBACK = 365;

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;

  const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (next < items.length) {
      const idx = next++;
      out[idx] = await fn(items[idx]!);
    }
  });

  await Promise.all(workers);
  return out;
}

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
  return zdLineMatchesOrder(line, symbol, productName, product.tw_Id) !== null;
}

type ScanResult = {
  kontrahent: SubiektKontrahent;
  documentNumber: string | null;
  sortKey: string;
  mappedSupplierId: string | null;
};

function docSortKey(doc: SubiektDocument): string {
  return `${doc.dok_DataWyst ?? ""}|${doc.dok_Id}`;
}

/** Przeszukuje ZD — zbiera trafienia i preferuje dostawcę powiązanego w aplikacji (kh_Id). */
async function scanProductInZdDocuments(
  product: SubiektProduct,
  appSuppliers: AppSupplierRef[],
  dataOdOverride?: string
): Promise<ScanResult | null> {
  const symbol = effectiveProductSymbol(product);
  const name = (product.tw_Nazwa ?? "").trim();
  const scopedSuppliers = dedupeAppSuppliersByKhId(appSuppliers);
  const plans = zdSearchPlansForProductSupplierLookup(product, scopedSuppliers);
  const seen = new Set<number>();
  let fetchedTotal = 0;
  const candidates: ScanResult[] = [];

  for (const plan of plans) {
    // Jeżeli już mamy dostawcę z mapowaniem i budżet się kończy — kończ wcześniej.
    if (candidates.some((c) => c.mappedSupplierId) && fetchedTotal >= MAX_ZD_DETAIL_FETCH_TOTAL) {
      break;
    }

    let list;
    try {
      list = await searchSubiektZdCached({
        ...plan,
        // Zrealizowane/zaksięgowane ZD mogą być traktowane jako "blocked" w API.
        // Do dopasowania dostawcy chcemy widzieć również zamknięte dokumenty.
        includeBlocked: true,
        dataOd: dataOdOverride ?? plan.dataOd ?? defaultZdSearchDataOd(),
      });
    } catch {
      continue;
    }

    if (!list.data.length || (list.pagination?.totalCount ?? 0) === 0) {
      continue;
    }

    const remainingBudget = Math.max(0, MAX_ZD_DETAIL_FETCH_TOTAL - fetchedTotal);
    if (remainingBudget <= 0) break;

    const toFetch: Array<{ dok_Id: number }> = [];
    for (const brief of list.data) {
      if (toFetch.length >= MAX_ZD_PER_SEARCH_PLAN) break;
      if (toFetch.length >= remainingBudget) break;
      if (seen.has(brief.dok_Id)) continue;
      seen.add(brief.dok_Id);
      toFetch.push({ dok_Id: brief.dok_Id });
    }

    if (!toFetch.length) continue;
    fetchedTotal += toFetch.length;

    const docs = await mapWithConcurrency(
      toFetch,
      ZD_DETAIL_FETCH_CONCURRENCY,
      async ({ dok_Id }) => {
        try {
          return await getSubiektDocumentCached(dok_Id);
        } catch {
          return null;
        }
      }
    );

    for (const doc of docs) {
      if (!doc) continue;

      const lines = doc.dok_Pozycja ?? [];
      if (!lines.some((line) => lineMatchesProduct(product, symbol, name, line))) {
        continue;
      }

      const kontrahent = kontrahentFromDoc(doc);
      if (!kontrahent) continue;

      const mappedSupplierId = matchSubiektKontrahentToSupplier(kontrahent, scopedSuppliers);

      candidates.push({
        kontrahent,
        documentNumber: doc.dok_NrPelny?.trim() ?? null,
        sortKey: docSortKey(doc),
        mappedSupplierId,
      });
    }
  }

  if (!candidates.length) return null;

  candidates.sort((a, b) => {
    const aMapped = a.mappedSupplierId ? 1 : 0;
    const bMapped = b.mappedSupplierId ? 1 : 0;
    if (aMapped !== bMapped) return bMapped - aMapped;
    return b.sortKey.localeCompare(a.sortKey);
  });

  return candidates[0] ?? null;
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

  const symbol = effectiveProductSymbol(product);
  const name = (product.tw_Nazwa ?? "").trim();
  if (!symbol && !name) return { status: "not_found" };

  const scopedSuppliers = dedupeAppSuppliersByKhId(appSuppliers);
  const dataOdPrimary = new Date(Date.now() - DATA_OD_DAYS_PRIMARY * MS_PER_DAY)
    .toISOString()
    .slice(0, 10);
  const dataOdFallback = new Date(Date.now() - DATA_OD_DAYS_FALLBACK * MS_PER_DAY)
    .toISOString()
    .slice(0, 10);

  // 1) świeższa historia (tańsza i bardziej trafna)
  let hit = await scanProductInZdDocuments(product, scopedSuppliers, dataOdPrimary);
  // 2) fallback: szersze okno
  if (!hit) {
    hit = await scanProductInZdDocuments(product, scopedSuppliers, dataOdFallback);
  }
  if (!hit) return { status: "not_found" };

  const subiektLabel = formatSubiektKontrahentLabel(hit.kontrahent);
  const supplierId = hit.mappedSupplierId;

  if (supplierId) {
    const supplierName =
      scopedSuppliers.find((s) => s.id === supplierId)?.name ?? subiektLabel;
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
