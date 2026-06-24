import { fetchDeliveryStats } from "@/lib/data/queries";
import { loadAppSupplierRefsWithAliases } from "@/lib/data/supplier-subiekt-kh";
import { browseZdDocumentsForKhIds } from "@/lib/subiekt/zd-eta-browse";
import {
  filterZdIndexRowsForPlacement,
  loadZdIndexRowsForPlacements,
  searchZdFromIndexForOrder,
} from "@/lib/subiekt/zd-eta-index-search";
import { findBestMatchingZdDocument } from "@/lib/subiekt/match-order-to-zd";
import { parseZdFulfillmentDeadline } from "@/lib/subiekt/zd-fulfillment-date";
import { getSubiektZdDocumentCached } from "@/lib/subiekt/subiekt-runtime-cache";
import {
  isZdEtaSyncEligible,
  liveSearchZdDocsByTwIdForOrder,
  liveSearchZdDocsForOrder,
  resolveSupplierKhIds,
  selectZdEtaSyncCandidates,
  buildZdIndexSearchEarlyStopHandlers,
  zdDocumentMatchesSupplierKhIds,
  ZD_ETA_EXTENDED_BROWSE_MAX_PAGES_PER_KH,
  ZD_ETA_EXTENDED_DOCS_PER_ORDER,
  ZD_ETA_INDEX_LIMIT_EXTENDED,
  ZD_ETA_MAX_LIVE_SEARCH_PLANS,
} from "@/lib/subiekt/zd-eta-sync";
import {
  placementIsOlderThanRollingWindow,
  sortMonthChunksNearPlacement,
  zdContractorExtendedDataOdForPlacement,
  zdPlacementBrowseMonthChunks,
  zdSearchPlacementAt,
} from "@/lib/subiekt/zd-search-scope";
import { isSubiektReachable } from "@/lib/subiekt/availability";
import { orderPlacementAt } from "@/lib/orders/order-timing";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeIndividualOrders } from "@/lib/data/normalize-order";
import type { IndividualOrder } from "@/types/database";
import type { SubiektDocument } from "@/lib/subiekt/types";
import { getAppSupplierRefsCached } from "@/lib/data/supplier-refs";

type SupplierRef = Awaited<ReturnType<typeof getAppSupplierRefsCached>>[number];

export type ZdEtaSearchMethod = "index" | "live" | "browse" | "none";

export type ZdEtaOrderDiagnosis = {
  orderId: string;
  supplier: string;
  symbol: string;
  products: string;
  orderedAt: string | null;
  method: ZdEtaSearchMethod;
  dokId: number | null;
  dokNr: string | null;
  deadline: string | null;
  indexCandidates: number;
  docsFetched: number;
  incomplete: boolean;
  note?: string;
};

export type DiagnoseZdEtaOptions = {
  salesPersonId?: string;
  maxOrders?: number;
  maxDocsPerOrder?: number;
};

function statsMapFromRows(
  stats: Awaited<ReturnType<typeof fetchDeliveryStats>>
): Record<string, (typeof stats)[number]> {
  const map: Record<string, (typeof stats)[number]> = {};
  for (const row of stats) {
    if (row.supplier_id) map[row.supplier_id] = row;
  }
  return map;
}

function matchOrderDoc(
  order: IndividualOrder,
  doc: SubiektDocument,
  khIds: readonly number[]
): boolean {
  if (!zdDocumentMatchesSupplierKhIds(doc, khIds)) return false;
  return Boolean(findBestMatchingZdDocument(order, [doc]));
}

async function fetchOrderPool(salesPersonId?: string): Promise<IndividualOrder[]> {
  const supabase = createAdminClient();
  const query = supabase
    .from("individual_orders")
    .select("*, supplier:suppliers(*)")
    .in("status", ["Zamowione", "Czesciowo_zrealizowane"])
    .eq("request_kind", "zamowienie")
    .is("sales_acknowledged_at", null);
  if (salesPersonId) query.eq("sales_person_id", salesPersonId);
  const res = await query;
  if (res.error) throw new Error(res.error.message);
  return normalizeIndividualOrders(res.data ?? []);
}

async function loadExtraKhIdsBySupplierIdFromZdIndex(): Promise<Map<string, number[]>> {
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

/** Jedna prośba — index (dok_id) → live search → browse (fallback). */
export async function diagnoseZdEtaForOrder(
  order: IndividualOrder,
  supplier: SupplierRef | undefined,
  khIds: readonly number[],
  options?: { maxDocsPerOrder?: number }
): Promise<ZdEtaOrderDiagnosis> {
  const maxDocsPerPhase = options?.maxDocsPerOrder ?? ZD_ETA_EXTENDED_DOCS_PER_ORDER;
  const placement = zdSearchPlacementAt(order);
  const extendedDataOd = zdContractorExtendedDataOdForPlacement(placement);
  const browseMonthChunks =
    placement && placementIsOlderThanRollingWindow(placement)
      ? sortMonthChunksNearPlacement(zdPlacementBrowseMonthChunks(placement), placement)
      : undefined;
  const skip = new Set<number>();

  const base = {
    orderId: order.id,
    supplier: supplier?.name ?? order.supplier?.name ?? "?",
    symbol: order.symbol ?? "-",
    products: order.products ?? "",
    orderedAt: orderPlacementAt(order),
    method: "none" as ZdEtaSearchMethod,
    dokId: null as number | null,
    dokNr: null as string | null,
    deadline: null as string | null,
    indexCandidates: 0,
    docsFetched: 0,
    incomplete: false,
  };

  let docsFetched = 0;

  const loadDocForPhase = (phaseBudget: number) => {
    let phaseFetched = 0;
    return async (dokId: number): Promise<SubiektDocument | null> => {
      if (phaseFetched >= phaseBudget) return null;
      phaseFetched++;
      docsFetched++;
      try {
        return await getSubiektZdDocumentCached(dokId);
      } catch {
        return null;
      }
    };
  };

  const finish = (
    method: ZdEtaSearchMethod,
    doc: SubiektDocument | null,
    extra?: Partial<ZdEtaOrderDiagnosis>
  ): ZdEtaOrderDiagnosis => {
    if (!doc) {
      return { ...base, ...extra, docsFetched, method: "none" };
    }
    return {
      ...base,
      ...extra,
      docsFetched,
      method,
      dokId: Math.trunc(Number(doc.dok_Id)) || null,
      dokNr: doc.dok_NrPelny?.trim() || null,
      deadline: parseZdFulfillmentDeadline(doc),
    };
  };

  const indexRows = await loadZdIndexRowsForPlacements(
    khIds,
    placement ? [placement] : [],
    new Date(),
    ZD_ETA_INDEX_LIMIT_EXTENDED
  );
  const scopedIndexRows = filterZdIndexRowsForPlacement(indexRows, placement);
  base.indexCandidates = scopedIndexRows.length;

  const indexSearch = await searchZdFromIndexForOrder(scopedIndexRows, {
    maxDocsToFetch: maxDocsPerPhase,
    skipDocIds: skip,
    loadDoc: loadDocForPhase(maxDocsPerPhase),
    preferIssueDateNear: placement ?? undefined,
    ...buildZdIndexSearchEarlyStopHandlers(order, khIds),
  });
  for (const doc of indexSearch.docs) {
    skip.add(Math.trunc(Number(doc.dok_Id)));
  }
  if (indexSearch.matched) {
    return finish("index", indexSearch.matched);
  }
  const indexMatched = indexSearch.docs
    .filter((doc) => matchOrderDoc(order, doc, khIds))
    .map((doc) => doc);
  const indexBest =
    indexMatched.length > 0
      ? findBestMatchingZdDocument(order, indexMatched)
      : null;
  if (indexBest) {
    return finish("index", indexBest);
  }

  const indexExhausted =
    scopedIndexRows.length > 0 &&
    (indexSearch.stoppedEarly || indexSearch.fetched >= scopedIndexRows.length);

  const oldPlacement = Boolean(
    placement && placementIsOlderThanRollingWindow(placement)
  );

  const runBrowse = async (): Promise<{
    hit: ZdEtaOrderDiagnosis | null;
    stoppedEarly: boolean;
  }> => {
    const browse = await browseZdDocumentsForKhIds({
      khIds,
      dataOd: browseMonthChunks?.[0]?.dataOd ?? extendedDataOd,
      monthChunks: browseMonthChunks,
      pageSize: 25,
      maxPagesPerKh: ZD_ETA_EXTENDED_BROWSE_MAX_PAGES_PER_KH,
      maxDocsToFetch: maxDocsPerPhase,
      skipDocIds: skip,
      loadDoc: loadDocForPhase(maxDocsPerPhase),
      preferIssueDateNear: placement ?? undefined,
    });
    const browseMatched = findBestMatchingZdDocument(order, browse.docs);
    if (browseMatched) {
      return {
        hit: finish("browse", browseMatched, { indexCandidates: indexRows.length }),
        stoppedEarly: browse.stoppedEarly,
      };
    }
    return { hit: null, stoppedEarly: browse.stoppedEarly };
  };

  const runLive = async (): Promise<ZdEtaOrderDiagnosis | null> => {
    const twSearch = await liveSearchZdDocsByTwIdForOrder(
      order,
      khIds,
      maxDocsPerPhase,
      skip,
      loadDocForPhase(maxDocsPerPhase)
    );
    if (twSearch.doc) {
      return finish("live", twSearch.doc, { indexCandidates: indexRows.length });
    }

    const live = await liveSearchZdDocsForOrder(
      order,
      khIds,
      ZD_ETA_MAX_LIVE_SEARCH_PLANS,
      maxDocsPerPhase,
      maxDocsPerPhase,
      skip,
      loadDocForPhase(maxDocsPerPhase)
    );
    if (live.matched) {
      return finish("live", live.matched, { indexCandidates: indexRows.length });
    }
    return null;
  };

  let browseStoppedEarly = false;

  if (oldPlacement) {
    const browseResult = await runBrowse();
    browseStoppedEarly = browseResult.stoppedEarly;
    if (browseResult.hit) return browseResult.hit;
  }

  const liveHit = await runLive();
  if (liveHit) return liveHit;

  if (!oldPlacement) {
    const browseResult = await runBrowse();
    browseStoppedEarly = browseResult.stoppedEarly;
    if (browseResult.hit) return browseResult.hit;
  }

  const staleIndex =
    indexRows.length > 0 &&
    orderPlacementAt(order) &&
    indexRows.every(
      (row) =>
        (row.dok_data_wyst ?? "").slice(0, 10) <
        (orderPlacementAt(order) ?? "").slice(0, 10)
    );

  return {
    ...base,
    docsFetched,
    incomplete:
      indexSearch.stoppedEarly ||
      browseStoppedEarly ||
      docsFetched >= maxDocsPerPhase * 3,
    note: staleIndex
      ? "indeks ZD starszy niż zamówienie — browse lub nocny catalog-zd-sync"
      : indexExhausted
        ? "sprawdzono indeks, brak dopasowania"
        : undefined,
  };
}

export async function diagnoseZdEtaCandidates(
  options: DiagnoseZdEtaOptions = {}
): Promise<ZdEtaOrderDiagnosis[]> {
  if (!(await isSubiektReachable())) {
    throw new Error("Subiekt niedostępny");
  }

  const [orders, statsRows, suppliers] = await Promise.all([
    fetchOrderPool(options.salesPersonId),
    fetchDeliveryStats(),
    loadAppSupplierRefsWithAliases(),
  ]);
  const statsMap = statsMapFromRows(statsRows);
  const supplierById = new Map(suppliers.map((s) => [s.id, s]));
  const extraKhBySupplierId = await loadExtraKhIdsBySupplierIdFromZdIndex();
  const candidates = selectZdEtaSyncCandidates(
    orders,
    statsMap,
    supplierById,
    Date.now(),
    { force: true, maxOrders: options.maxOrders ?? 48 }
  );

  const out: ZdEtaOrderDiagnosis[] = [];
  for (const order of candidates) {
    const supplier = order.supplier_id
      ? supplierById.get(order.supplier_id)
      : undefined;
    const khIds = order.supplier_id
      ? resolveSupplierKhIds(supplier, order.supplier_id, extraKhBySupplierId)
      : [];
    if (!khIds.length) {
      out.push({
        orderId: order.id,
        supplier: supplier?.name ?? "?",
        symbol: order.symbol ?? "-",
        products: order.products ?? "",
        orderedAt: orderPlacementAt(order),
        method: "none",
        dokId: null,
        dokNr: null,
        deadline: null,
        indexCandidates: 0,
        docsFetched: 0,
        incomplete: false,
        note: "brak subiekt_kh_id u dostawcy",
      });
      continue;
    }
    if (!isZdEtaSyncEligible(order)) {
      continue;
    }
    out.push(
      await diagnoseZdEtaForOrder(order, supplier, khIds, {
        maxDocsPerOrder: options.maxDocsPerOrder,
      })
    );
  }
  return out;
}
