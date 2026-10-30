/**
 * Silnik zamówień ZD — jedno wyliczenie listy „Do ZD” dla zakresu (grupa/cecha)
 * i dostawcy. Używa go Kreator ZD (Policz) i nocny przebieg panelu Braki,
 * żeby obie liczby były identyczne.
 *
 * Moduł serwerowy (DB + Subiekt ORDERS). Bez autoryzacji — caller sprawdza uprawnienia.
 */

import { userFacingErrorText } from "@/lib/ui/user-facing-error";
import { fetchZdEstimateExclusions, type ZdEstimateExclusionRow } from "@/lib/data/zd-estimate-exclusions";
import { fetchZdEstimateOnRequests, type ZdEstimateOnRequestRow } from "@/lib/data/zd-estimate-on-request";
import {
  buildBakeExcludedTwIds,
  buildExtraOnlyTwIds,
  buildOrderExcludedTwIds,
  onRequestTwIdSet,
} from "@/lib/orders/zd-estimate-on-request";
import { fetchZdEstimatePackaging, type ZdEstimatePackagingRow } from "@/lib/data/zd-estimate-packaging";
import {
  fetchZdEstimateMinStock,
  minStockRowsToMap,
  type ZdEstimateMinStockRow,
} from "@/lib/data/zd-estimate-min-stock";
import { fetchZdBoostPowerPreset } from "@/lib/data/zd-estimate-boost-preset";
import { fetchZdEstimateExtrasPolicy } from "@/lib/data/zd-estimate-extras-policy";
import {
  ZD_ESTIMATE_EXTRAS_POLICY_DEFAULT,
  type ZdEstimateExtrasPolicy,
} from "@/lib/orders/zd-estimate-extras-policy";
import { policyForBoostPreset, type ZdBoostPowerPreset } from "@/lib/orders/zd-estimate-boost-presets";
import { fetchZdProductPairs, type ZdProductPairRow } from "@/lib/data/zd-product-pairs";
import { fetchZdProductBoms, type ZdProductBomRow } from "@/lib/data/zd-product-boms";
import { bomRowsToRefs, type ZdProductBomRef } from "@/lib/orders/zd-estimate-bom";
import { normalizeDemandAllocation } from "@/lib/orders/zd-estimate-bom-policy";
import { withPairMinStock } from "@/lib/orders/zd-estimate-min-stock-lookup";
import {
  applyStockoutAdjustToLine,
  businessDaysInWindow,
  computeStockoutSalesFactor,
  loadStockHistoryWindow,
  stockoutMetaExcludingProsba,
} from "@/lib/stock-watch/stock-history";
import { ZD_BOM_UI } from "@/lib/orders/zd-estimate-bom-copy";
import { collectMissingZdBomTwIds } from "@/lib/orders/zd-estimate-live-refresh";
import { normalizeIndividualOrders } from "@/lib/data/normalize-order";
import {
  listZdEstimateSupplierKhIds,
  partitionProsbaOverlapFetchTwIds,
} from "@/lib/orders/zd-estimate-create-zd";
import {
  buildIndividualEstimateExtras,
  individualExtraPiecesMap,
  mapIndividualOrderToPendingDto,
  type ZdEstimatePendingIndividualOrder,
} from "@/lib/orders/zd-estimate-individual";
import {
  buildManualZdEstimateResult,
  ZD_ESTIMATE_MISSING_SKU_FETCH_CONCURRENCY,
  type ManualZdEstimateResult,
} from "@/lib/orders/zd-estimate-manual";
import { mapPool } from "@/lib/async/map-pool";
import {
  summarizePackOrderQty,
  type PackagingLookup,
  type ZdPackagingDocumentUnitMode,
} from "@/lib/orders/zd-estimate-packaging";
import { mergeZdEstimateExcludedTwIds } from "@/lib/orders/zd-estimate-name-exclude";
import { fetchTeethProductTwIdSet } from "@/lib/data/teeth-products";
import {
  fetchLatestSnapshotHistoryByTwIds,
  listSnapshotHistoryScopesForKh,
  type ZdEstimateHistoryScope,
} from "@/lib/data/zd-estimate-order-snapshots";
import { createAdminClient } from "@/lib/supabase/admin";
import { listZdEstimateSupplierScopesFor } from "@/lib/data/zd-estimate-supplier-scopes";
import {
  countIncompleteProsbyForSupplier,
  loadLastZdSupplierByTwIds,
  loadProsbyElsewhereByTwIds,
  loadZdProductAssignments,
  type ZdProsbaElsewhere,
} from "@/lib/data/zd-scope-order";
import {
  fetchSubiektZdEstimateAll,
} from "@/lib/subiekt/api";
import { fetchZdSupplierOrderPolicy } from "@/lib/data/zd-supplier-order-policy";
import { applyStaleOpenZdToLine, loadStaleOpenZdByTwId, type ZdStaleOpenZd } from "@/lib/data/zd-stale-open-zd";
import {
  applySalesCorrectionsToLine,
  loadSalesCorrectionsByDay,
  subtractCorrectionsFromWindows,
} from "@/lib/data/subiekt-sales-corrections";
import { loadZdLineDecisionPatterns, type ZdLineDecisionPattern } from "@/lib/data/zd-line-decisions";
import { applyUserPatternToManualLine } from "@/lib/orders/zd-user-pattern";
import { zdDocumentUnitsToPieces } from "@/lib/orders/zd-estimate-units";
import type { ManualZdEstimateLine } from "@/lib/orders/zd-estimate-manual";
import {
  applyZdDemandFloorToLine,
  applyZdPairDemandFloor,
  resolveZdRunDniZapasu,
  applyZdBomDemandFloor,
  ZD_SUPPLIER_ORDER_POLICY_CLASSIC,
  type ZdSupplierOrderPolicy,
} from "@/lib/orders/zd-demand-policy";
import { requireZdEstimateSnapshotHostKind } from "@/lib/subiekt/config";
import { getSubiektFeedback, type SubiektFeedback } from "@/lib/subiekt/feedback";
import { assertZdEstimateFilterEcho } from "@/lib/orders/zd-estimate-scope";
import type { ZdEstimateRunProgressSnapshot } from "@/lib/orders/zd-estimate-run-progress";
import { fetchReservedOverlapSlicesByTwIds } from "@/lib/orders/zd-reserved-overlap-fetch";
import {
  collectTwIdsNeedingProsbaReservationOverlap,
  collectTwIdsNeedingProsbaReservationOverlapWithoutStanRez,
  individualExtrasAndReliefWithReservationOverlap,
  buildZdOverlapReservationSources,
  linesWithReservationSources,
  mergeReservedSlicesBySources,
  reservationSourceTwIds,
  type ZdOverlapReservationSources,
  type ZdEstimateProsbaOverlapContribution,
  type ZdEstimateReservedOverlapSlice,
} from "@/lib/orders/zd-estimate-prosba-reservation-overlap";
import {
  applyZdSalesProfileToLine,
  applyZdStockoutFallbackToLine,
  resolveZdSalesProfile,
  sales90CappedFromProfile,
  type ZdSalesSmoothingSummary,
} from "@/lib/orders/zd-sales-profile";
import {
  ensureZdSalesProfiles,
  loadDeliveredProsbaPiecesByFloorWindow,
  loadDeliveredProsbaPiecesByTwId,
  type ZdSalesProfileScope,
} from "@/lib/orders/zd-sales-profile-load";

const ZD_ESTIMATE_PENDING_INDIVIDUALS_LIMIT = 500;

/** Wiszące prośby (zamówienie Nowe) dostawcy do kreatora ZD. */
export async function fetchZdEstimatePendingIndividualOrders(
  supplierId: string
): Promise<{
  orders: ZdEstimatePendingIndividualOrder[];
  truncated: boolean;
}> {
  const id = String(supplierId ?? "").trim();
  if (!id) return { orders: [], truncated: false };
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("individual_orders")
    .select("*, sales_person:sales_people(*)")
    .eq("supplier_id", id)
    .eq("status", "Nowe")
    .or("is_teeth.is.null,is_teeth.eq.false")
    .order("action_at", { ascending: false })
    .limit(ZD_ESTIMATE_PENDING_INDIVIDUALS_LIMIT);
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const truncated = rows.length >= ZD_ESTIMATE_PENDING_INDIVIDUALS_LIMIT;
  const ordersNorm = normalizeIndividualOrders(rows);
  const out: ZdEstimatePendingIndividualOrder[] = [];
  for (const order of ordersNorm) {
    const dto = mapIndividualOrderToPendingDto(order);
    if (dto) out.push(dto);
  }
  return { orders: out, truncated };
}


export async function resolveSupplierKhIdsForHistory(
  supplierId: string | null | undefined
): Promise<
  | { ok: true; khIds: number[] }
  | { ok: false; message: string }
> {
  const id = String(supplierId ?? "").trim();
  if (!id) {
    return { ok: false, message: "Brak identyfikatora dostawcy." };
  }
  const supabase = createAdminClient();
  const { data: supplier, error } = await supabase
    .from("suppliers")
    .select("id, subiekt_kh_id")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    return { ok: false, message: error.message };
  }
  if (!supplier) {
    return { ok: false, message: "Nie znaleziono dostawcy w OnTime." };
  }
  const { data: aliases, error: aliasErr } = await supabase
    .from("supplier_subiekt_kh_aliases")
    .select("subiekt_kh_id")
    .eq("supplier_id", id);
  if (aliasErr) {
    return {
      ok: false,
      message: `Nie udało się wczytać aliasów kh dostawcy: ${aliasErr.message}`,
    };
  }
  const additional = (aliases ?? [])
    .map((r) => Math.trunc(Number((r as { subiekt_kh_id: number }).subiekt_kh_id)))
    .filter((n) => n > 0);
  const khIds = listZdEstimateSupplierKhIds({
    primaryKhId: (supplier as { subiekt_kh_id: number | null }).subiekt_kh_id,
    additionalKhIds: additional,
  });
  if (khIds.length === 0) {
    return {
      ok: false,
      message:
        "Dostawca nie ma powiązania z Subiektem (kh_Id). Uzupełnij w Administracji → Dostawcy.",
    };
  }
  return { ok: true, khIds };
}


export function historyScopeFromRun(scope: {
  mode: "grupa" | "cecha";
  grupaId?: number | null;
  cechaId?: number | null;
}): ZdEstimateHistoryScope | null {
  if (scope.mode === "grupa" && scope.grupaId != null && scope.grupaId > 0) {
    return { mode: "grupa", grtId: scope.grupaId };
  }
  if (scope.mode === "cecha" && scope.cechaId != null && scope.cechaId > 0) {
    return { mode: "cecha", cechaId: scope.cechaId };
  }
  return null;
}


export { fetchReservedOverlapSlicesByTwIds };

export function reservedOverlapMapToDto(
  map: Map<number, ZdEstimateReservedOverlapSlice[]>
): Record<string, ZdEstimateReservedOverlapSlice[]> {
  const dto: Record<string, ZdEstimateReservedOverlapSlice[]> = {};
  for (const [tw, slices] of map) {
    if (slices.length) dto[String(tw)] = slices;
  }
  return dto;
}

/**
 * Korekta extras o overlap prośba↔rez. ZK.
 * `resolved=false` gdy fetch rzucił — caller nie powinien cache'ować skip.
 *
 * `coverLines` (create): fetch ZK tylko dla kandydatów z ilosc < minZd(raw);
 * scoped extras nadal obejmują wszystkie twIdsFilter (non-identity zostają).
 */
export async function resolveIndividualExtrasWithReservationOverlap(input: {
  byTwId: ReadonlyMap<
    number,
    {
      extraPieces: number;
      overlapContributions?: readonly ZdEstimateProsbaOverlapContribution[];
    }
  >;
  /** Linie ze stanRez — gdy brak, dociągamy ZK dla wszystkich tw z extra. */
  lines?: readonly { tw_Id: number; tw_StanRez?: number | null }[] | null;
  /** Gdy podane — tylko te tw (np. Create: pozycje na dokumencie). */
  twIdsFilter?: ReadonlySet<number> | null;
  /**
   * Create: linie przed ensureCover — partition skipCover vs toFetch.
   * Policz nie podaje → fetch wszystkich candidates (bez zmian).
   */
  coverLines?: readonly { twId: number; ilosc: number }[] | null;
  unitsPerPackageByTwId?: ReadonlyMap<number, number> | null;
  packagingModeByTwId?: ReadonlyMap<
    number,
    ZdPackagingDocumentUnitMode
  > | null;
  /**
   * Pary i zestawy „Składamy”: ZK klienta rezerwuje inną kartę niż ta z prośbą (sztuka pary,
   * karta zestawu) — rezerwacje kart źródłowych scalane na linii w jednostkach jej extra.
   */
  reservationSources?: ZdOverlapReservationSources | null;
  fetchOpts?: Parameters<typeof fetchReservedOverlapSlicesByTwIds>[1];
}): Promise<{
  adjustedExtraByTwId: Map<number, number>;
  rawExtraByTwId: Map<number, number>;
  extraOverlapByTwId: Map<number, number>;
  stockNeedReliefByTwId: Map<number, number>;
  reservedByTwId: Map<number, ZdEstimateReservedOverlapSlice[]>;
  candidateTwIds: number[];
  overlapTwFetched: number[];
  overlapTwSkipped: number[];
  resolved: boolean;
}> {
  const scopedByTw =
    input.twIdsFilter != null
      ? new Map(
          [...input.byTwId].filter(([tw]) => input.twIdsFilter!.has(tw))
        )
      : input.byTwId;

  const rawMap = new Map<number, number>();
  for (const [tw, extra] of scopedByTw) {
    if (extra.extraPieces > 0) rawMap.set(tw, extra.extraPieces);
  }

  const sources = input.reservationSources ?? new Map();
  // Rezerwacja na którejkolwiek karcie źródłowej czyni linię kandydatem.
  const linesForCandidates = input.lines?.length ? linesWithReservationSources(input.lines, sources) : null;
  const candidateTwIds = linesForCandidates
    ? collectTwIdsNeedingProsbaReservationOverlap({
        extraTwIds: rawMap.keys(),
        lines: linesForCandidates,
        byTwId: scopedByTw,
      })
    : collectTwIdsNeedingProsbaReservationOverlapWithoutStanRez({
        byTwId: scopedByTw,
      });

  let toFetch = candidateTwIds;
  let skipCover: number[] = [];
  if (input.coverLines != null) {
    const linesByTwId = new Map<number, { ilosc: number }>();
    for (const line of input.coverLines) {
      const tw = Math.trunc(Number(line.twId)) || 0;
      if (!(tw > 0)) continue;
      linesByTwId.set(tw, { ilosc: Number(line.ilosc) || 0 });
    }
    const parted = partitionProsbaOverlapFetchTwIds({
      candidates: candidateTwIds,
      rawExtraByTwId: rawMap,
      linesByTwId,
      unitsPerPackageByTwId: input.unitsPerPackageByTwId,
      packagingModeByTwId: input.packagingModeByTwId,
    });
    toFetch = parted.toFetch;
    skipCover = parted.skipCover;
  }

  if (!candidateTwIds.length || !toFetch.length) {
    return {
      adjustedExtraByTwId: rawMap,
      rawExtraByTwId: rawMap,
      extraOverlapByTwId: new Map(),
      stockNeedReliefByTwId: new Map(),
      reservedByTwId: new Map(),
      candidateTwIds,
      overlapTwFetched: [],
      overlapTwSkipped: skipCover,
      resolved: true,
    };
  }

  try {
    const fetched = await fetchReservedOverlapSlicesByTwIds(
      reservationSourceTwIds(toFetch, sources),
      input.fetchOpts
    );
    fetched.reservedByTwId = mergeReservedSlicesBySources(fetched.reservedByTwId, toFetch, sources);
    const maps = individualExtrasAndReliefWithReservationOverlap(
      scopedByTw,
      fetched.reservedByTwId
    );
    const adjustedExtraByTwId = new Map<number, number>();
    for (const [tw, raw] of maps.extraByTwId) {
      const overlap = maps.extraOverlapByTwId.get(tw) ?? 0;
      // Policz bez coverLines: bit-identycznie jak wcześniej (nie ceil tutaj —
      // overlap z dedupe i tak jest ceil; applyOverlapToExtraPieces zmienia floats).
      const effective = Math.max(0, raw - overlap);
      if (effective > 0) adjustedExtraByTwId.set(tw, effective);
    }
    return {
      adjustedExtraByTwId,
      rawExtraByTwId: maps.extraByTwId,
      extraOverlapByTwId: maps.extraOverlapByTwId,
      stockNeedReliefByTwId: maps.stockNeedReliefByTwId,
      reservedByTwId: fetched.reservedByTwId,
      candidateTwIds,
      overlapTwFetched: toFetch,
      overlapTwSkipped: skipCover,
      // Częściowy sukces: stosujemy to co mamy, ale UI może dociągnąć ponownie.
      resolved: !fetched.hadFetchErrors,
    };
  } catch {
    return {
      adjustedExtraByTwId: rawMap,
      rawExtraByTwId: rawMap,
      extraOverlapByTwId: new Map(),
      stockNeedReliefByTwId: new Map(),
      reservedByTwId: new Map(),
      candidateTwIds,
      overlapTwFetched: toFetch,
      overlapTwSkipped: skipCover,
      resolved: false,
    };
  }
}


export type ZdOrderEngineProgressPatch = Partial<
  Pick<
    ZdEstimateRunProgressSnapshot,
    "phase" | "pagesCommitted" | "totalPages" | "totalCountApi" | "linesSoFar" | "message"
  >
>;

export type ZdOrderEngineInput = {
  scope:
    | { mode: "grupa"; grupaId: number; cechaId: null }
    | { mode: "cecha"; grupaId: null; cechaId: number };
  /** Dostawca OnTime — historia snapshotów (kh + aliasy) i prośby. Bez → bez historii i próśb. */
  supplierId: string | null;
  dniZapasu: number;
  /**
   * Czas dostawy i dni do kolejnego zamówienia (jak horyzont „do kolejnej dostawy”) —
   * strategia z własnymi dniami celu liczy co najmniej cykl + dostawę.
   */
  orderTiming?: { leadDays: number; nextOrderDays: number } | null;
  /**
   * Kreator: dni z karty dostawcy (zwykłe zamówienie) i same dni z pola. Dłuższy bieg (pole ponad kartę,
   * horyzont) liczy podbicia i skok vs ostatnie ZD jak przy zwykłym zamówieniu; pole ponad kartę podnosi
   * też cel strategii z własnymi dniami (`resolveZdRunDniZapasu`). Brak = jak dotąd (automat, backtest).
   */
  normalDniZapasu?: number | null;
  manualDniZapasu?: number | null;
  dataOd: string;
  dataDo: string;
  zapasMin: number;
  ordersBaseUrl: string;
  /**
   * Opcja Kreatora (domyślnie wyłączona): jednorazowe skoki i rzadka sprzedaż liczone
   * z profilu 12 miesięcy, sprzedaż pod zrealizowane prośby poza tempem.
   * Profil (znaczniki) liczy się zawsze — wygładzenie tylko przy tej opcji.
   */
  salesSmoothing?: boolean;
  /** Kreator: "background" (nie czeka na odświeżenie profilu do 14 dni). Nocny przebieg: "sync". */
  salesProfileRefresh?: "sync" | "background";
  /**
   * Strategia dostawcy (zd_supplier_order_policy). Brak = wczytana z bazy dla `supplierId`
   * (bez dostawcy: classic). Podgląd / testy mogą ją podać wprost.
   */
  orderPolicy?: ZdSupplierOrderPolicy;
  /**
   * Strategia testowa: policz też „jak dotąd” z tego samego pobrania (cel przeliczony na dni
   * wywołującego, bez podłogi i bez wygładzenia) — porównanie w Kreatorze bez drugiego przebiegu.
   */
  compareClassic?: boolean;
  onProgress?: (patch: ZdOrderEngineProgressPatch) => void;
};

export type { ZdSalesSmoothingSummary };

export type ZdOrderScopeIncluded = { mode: "grupa" | "cecha"; id: number; label: string };

export type ZdOrderAssignedElsewhere = {
  twId: number;
  twSymbol: string | null;
  twNazwa: string;
  supplierId: string;
};

export type ZdOrderEngineOutput = {
  result: ManualZdEstimateResult;
  /** Zakresy w tym wyliczeniu: główny + pozostałe zakresy dostawcy. */
  scopesIncluded: ZdOrderScopeIncluded[];
  /** Towary ukryte, bo przypisane innemu dostawcy (wspólny zakres). */
  assignedElsewhere: ZdOrderAssignedElsewhere[];
  /** tw → nazwa dostawcy z ostatniego ZD, gdy inny niż liczony. */
  otherSupplierHintByTwId: Record<number, string>;
  /** tw → wiszące prośby na ten towar przypisane innemu dostawcy (podpowiedź). */
  prosbyElsewhereByTwId: Record<number, ZdProsbaElsewhere[]>;
  /** Prośby tego dostawcy w Weryfikacji — poza Kreatorem do uzupełnienia; null = nie udało się policzyć. */
  incompleteProsbyCount: number | null;
  fetch: { pagesFetched: number; totalCountApi: number; truncated: boolean };
  historyByTwId: Map<number, { lastOrderedQty: number; linkedAt: string }> | null;
  historyFetchFailed: boolean;
  pendingIndividuals: ZdEstimatePendingIndividualOrder[] | null;
  pendingIndividualsTruncated: boolean;
  pendingIndividualsError: string | null;
  salesSmoothing: ZdSalesSmoothingSummary | null;
  prosbaReservedByTwId: Map<number, ZdEstimateReservedOverlapSlice[]> | null;
  prosbaOverlapCandidateTwIds: number[] | undefined;
  prosbaOverlapResolved: boolean;
  exclusions: ZdEstimateExclusionRow[];
  onRequests: ZdEstimateOnRequestRow[];
  packaging: ZdEstimatePackagingRow[];
  minStock: ZdEstimateMinStockRow[];
  minStockByTwId: Map<number, number>;
  productPairs: ZdProductPairRow[];
  productBoms: ZdProductBomRow[];
  bomRefs: ZdProductBomRef[];
  teethTwIds: number[];
  boostPreset: ZdBoostPowerPreset;
  extrasPolicy: ZdEstimateExtrasPolicy;
  /** Strategia, z którą liczono (classic = jak dotąd); dni zapasu już z niej. */
  orderPolicy: ZdSupplierOrderPolicy;
  /** Dni zapasu faktycznie użyte w celu (strategia może nadpisać dni wywołującego / horyzont). */
  dniZapasuUsed: number;
  /** „Jak dotąd” dla porównania (tylko przy compareClassic i strategii innej niż classic). */
  classicResult: ManualZdEstimateResult | null;
  /** Wykluczenia twarde (DB ∪ auto z nazwy ∪ zęby) na pozycjach wyniku. */
  hardExcludedTwIds: Set<number>;
  onRequestTwIds: Set<number>;
  packagingLookup: Map<number, PackagingLookup>;
  missingPartnerTwIds: Set<number>;
  missingBomTwIds: Set<number>;
  kpi: {
    doZamowieniaCount: number;
    zdUnitsSuma: number;
    doZamowieniaCountRaw: number;
    zdUnitsSumaRaw: number;
    excludedInGroupCount: number;
  };
};

/**
 * Policz: pełna lista zakresu z Subiekta + reguły (wykluczenia, na prośbę, opakowania,
 * minimum, pary, BOM, zęby) + dociągnięcie partnerów/BOM/próśb + historia + boost.
 *
 * `{ ok: false }` = reguły niedostępne (lista nie może się pokazać).
 * Błędy Subiekta (timeout, 5xx, odrzucona 1. strona) lecą wyjątkiem.
 */
export async function runZdOrderEngine(
  input: ZdOrderEngineInput
): Promise<
  | ({ ok: true } & ZdOrderEngineOutput)
  | { ok: false; feedback: SubiektFeedback }
> {
  const { scope, dataOd, dataDo, zapasMin } = input;
  const touchProgress = (patch: ZdOrderEngineProgressPatch) => {
    input.onProgress?.(patch);
  };

  // Strategia przed pobraniem listy: Subiekt liczy cel z dni zapasu już w zapytaniu.
  let orderPolicy: ZdSupplierOrderPolicy = input.orderPolicy ?? ZD_SUPPLIER_ORDER_POLICY_CLASSIC;
  if (!input.orderPolicy && input.supplierId) {
    try {
      orderPolicy = await fetchZdSupplierOrderPolicy(input.supplierId);
    } catch (e) {
      const feedback = getSubiektFeedback("empty_query", {
        title: "Strategia dostawcy niedostępna",
        message: `Lista nie została pokazana - bez strategii dostawcy ilości mogłyby być liczone inaczej niż w propozycji automatu. ${userFacingErrorText(e, "Nie udało się wczytać strategii dostawcy.")}`,
        hint: "Odśwież stronę lub spróbuj ponownie za chwilę.",
      });
      return { ok: false, feedback };
    }
  }
  const { dniZapasu, signalDniZapasu } = resolveZdRunDniZapasu({
    policy: orderPolicy,
    dniZapasu: input.dniZapasu,
    normalDniZapasu: input.normalDniZapasu,
    manualDniZapasu: input.manualDniZapasu,
    timing: input.orderTiming,
  });

  // Pełna lista towarów zakresu z Subiekta (nie tylko braki API / nie nasza baza).
  // Echo filtra zaraz po 1. stronie — bez tego stary API mógłby dociągnąć cały katalog.
  touchProgress({ phase: "fetch" });
  // Profil sprzedaży zakresu — równolegle z pobieraniem listy (świeży z bazy albo 12 okien z API).
  const profileOf = (scopes: ZdSalesProfileScope[]) =>
    scopes.length === 0
      ? Promise.resolve(new Map<number, number[]>())
      : ensureZdSalesProfiles({
          scopes,
          endDate: dataDo,
          refresh: input.salesProfileRefresh ?? "sync",
        }).catch((e: unknown) => {
          console.warn("[zd-sales-profile]", e);
          return null;
        });
  const primaryProfiles = profileOf([
    { mode: scope.mode, id: (scope.mode === "cecha" ? scope.cechaId : scope.grupaId) ?? 0 },
  ]);
  let lastFetchProgress = {
    pagesCommitted: 0,
    totalPages: 0,
    totalCountApi: 0,
    linesSoFar: 0,
  };
  const primaryFetched = await fetchSubiektZdEstimateAll(
    {
      ...(scope.mode === "grupa"
        ? { grupaId: scope.grupaId }
        : { cechaId: scope.cechaId }),
      dniZapasu,
      dataOd,
      dataDo,
      zapasMin: zapasMin > 0 ? zapasMin : undefined,
      tylkoBraki: false,
    },
    {
      validateFirstPage: ({ parametry }) =>
        assertZdEstimateFilterEcho({
          mode: scope.mode,
          expectedGrupaId: scope.grupaId,
          expectedCechaId: scope.cechaId,
          parametry,
        }),
      onProgress: (p) => {
        lastFetchProgress = {
          pagesCommitted: p.pagesCommitted,
          totalPages: p.totalPages,
          totalCountApi: p.totalCountApi,
          linesSoFar: p.linesSoFar,
        };
        touchProgress({
          phase: "fetch",
          pagesCommitted: p.pagesCommitted,
          totalPages: p.totalPages,
          totalCountApi: p.totalCountApi,
          linesSoFar: p.linesSoFar,
        });
      },
    }
  );
  // Pozostałe zakresy dostawcy (gdy liczymy jego zakres) — jedna lista „Do ZD”.
  const supplierScopes = input.supplierId
    ? await listZdEstimateSupplierScopesFor(input.supplierId)
    : [];
  const scopeIdOf = (s: { mode: string; grupaId: number | null; cechaId: number | null }) =>
    (s.mode === "cecha" ? s.cechaId : s.grupaId) ?? 0;
  const requestedScopeId = scopeIdOf(scope);
  const isSupplierScope = supplierScopes.some(
    (s) => s.mode === scope.mode && scopeIdOf(s) === requestedScopeId
  );
  const extraScopes = isSupplierScope
    ? supplierScopes.filter((s) => !(s.mode === scope.mode && scopeIdOf(s) === requestedScopeId))
    : [];
  const scopesIncluded: ZdOrderScopeIncluded[] = [
    {
      mode: scope.mode,
      id: requestedScopeId,
      label: supplierScopes.find((s) => s.mode === scope.mode && scopeIdOf(s) === requestedScopeId)
        ?.label ?? "",
    },
    ...extraScopes.map((s) => ({ mode: s.mode, id: scopeIdOf(s), label: s.label })),
  ];
  const extraProfiles = profileOf(extraScopes.map((s) => ({ mode: s.mode, id: scopeIdOf(s) })));
  let fetched = primaryFetched;
  for (const [extraIndex, extra] of extraScopes.entries()) {
    const extraId = scopeIdOf(extra);
    // Dostawca z kilkoma zakresami — bez tego pasek stał na „pobieram” bez postępu.
    touchProgress({
      phase: "fetch",
      message: `Kolejny zakres dostawcy (${extraIndex + 2} z ${extraScopes.length + 1}): ${extra.label || `#${extraId}`}`,
    });
    const more = await fetchSubiektZdEstimateAll(
      {
        ...(extra.mode === "grupa" ? { grupaId: extraId } : { cechaId: extraId }),
        dniZapasu,
        dataOd,
        dataDo,
        zapasMin: zapasMin > 0 ? zapasMin : undefined,
        tylkoBraki: false,
      },
      {
        validateFirstPage: ({ parametry }) =>
          assertZdEstimateFilterEcho({
            mode: extra.mode,
            expectedGrupaId: extra.mode === "grupa" ? extraId : null,
            expectedCechaId: extra.mode === "cecha" ? extraId : null,
            parametry,
          }),
      }
    );
    const seen = new Set(fetched.pozycje.map((p) => Math.trunc(Number(p.tw_Id) || 0)));
    fetched = {
      ...fetched,
      pozycje: [
        ...fetched.pozycje,
        ...more.pozycje.filter((p) => !seen.has(Math.trunc(Number(p.tw_Id) || 0))),
      ],
      pagesFetched: fetched.pagesFetched + more.pagesFetched,
      totalCountApi: fetched.totalCountApi + more.totalCountApi,
      truncated: fetched.truncated || more.truncated,
    };
  }

  // W parametrach wyniku — przeliczenia na kliencie (opakowania, pary, sesja) liczą korekty tak samo.
  fetched = {
    ...fetched,
    parametry: {
      ...fetched.parametry,
      ...(signalDniZapasu != null ? { dniZapasuSygnaly: signalDniZapasu } : {}),
      ...(orderPolicy.strategy !== "classic" ? { bezSkokuZd: true } : {}),
    },
  };

  touchProgress({
    phase: "settings",
    message: null,
    pagesCommitted: Math.max(lastFetchProgress.pagesCommitted, fetched.pagesFetched),
    totalPages: Math.max(lastFetchProgress.totalPages, fetched.pagesFetched, 1),
    totalCountApi: lastFetchProgress.totalCountApi || fetched.totalCountApi,
    linesSoFar: fetched.pozycje.length,
  });
  let historyByTwId: Map<number, { lastOrderedQty: number; linkedAt: string }> | null =
    null;
  let historyFetchFailed = false;
  const khResolve = await resolveSupplierKhIdsForHistory(input.supplierId);
  const supplierKhIds = khResolve.ok ? khResolve.khIds : [];
  const hostKind = requireZdEstimateSnapshotHostKind(input.ordersBaseUrl);
  // Historia ze wszystkich zakresów dostawcy — ZD zapisuje się pod zakresem głównym
  // uruchomienia, więc towar z drugiego zakresu ma historię pod pierwszym.
  const historyScopes = scopesIncluded
    .map((s) =>
      historyScopeFromRun(
        s.mode === "grupa"
          ? { mode: "grupa", grupaId: s.id }
          : { mode: "cecha", cechaId: s.id }
      )
    )
    .filter((s): s is ZdEstimateHistoryScope => s != null);
  // Dawne zakresy dostawcy (zmienione / usunięte) — historia ZD nie może zniknąć
  // tylko dlatego, że ktoś poprawił mapowanie.
  if (isSupplierScope && supplierKhIds.length > 0) {
    try {
      const seen = new Set(historyScopes.map((h) => (h.mode === "grupa" ? `g${h.grtId}` : `c${h.cechaId}`)));
      for (const h of await listSnapshotHistoryScopesForKh(supplierKhIds, hostKind)) {
        const key = h.mode === "grupa" ? `g${h.grtId}` : `c${h.cechaId}`;
        if (!seen.has(key)) {
          seen.add(key);
          historyScopes.push(h);
        }
      }
    } catch {
      // Bez dawnych zakresów — historia z obecnych nadal działa.
    }
  }
  const historyFilters =
    supplierKhIds.length > 0 && historyScopes.length > 0
      ? { supplierKhIds, scopes: historyScopes, hostKind }
      : null;
  // Historię ładujemy raz — po dociągnięciu partnerów/BOM/próśb (patrz niżej).

  const [
    exclusionsSettled,
    onRequestsSettled,
    packagingSettled,
    minStockSettled,
    productPairsSettled,
    productBomsSettled,
    teethSettled,
  ] = await Promise.all([
    fetchZdEstimateExclusions()
      .then((value) => ({ ok: true as const, value }))
      .catch((e: unknown) => ({ ok: false as const, error: e })),
    fetchZdEstimateOnRequests()
      .then((value) => ({ ok: true as const, value }))
      .catch((e: unknown) => ({ ok: false as const, error: e })),
    fetchZdEstimatePackaging()
      .then((value) => ({ ok: true as const, value }))
      .catch((e: unknown) => ({ ok: false as const, error: e })),
    fetchZdEstimateMinStock()
      .then((value) => ({ ok: true as const, value }))
      .catch((e: unknown) => ({ ok: false as const, error: e })),
    fetchZdProductPairs()
      .then((value) => ({ ok: true as const, value }))
      .catch((e: unknown) => ({ ok: false as const, error: e })),
    fetchZdProductBoms()
      .then((value) => ({ ok: true as const, value }))
      .catch((e: unknown) => ({ ok: false as const, error: e })),
    fetchTeethProductTwIdSet()
      .then((value) => ({ ok: true as const, value }))
      .catch((e: unknown) => ({ ok: false as const, error: e })),
  ]);

  if (!exclusionsSettled.ok) {
    const message = userFacingErrorText(
      exclusionsSettled.error,
      "Nie udało się wczytać listy wykluczeń."
    );
    const feedback = getSubiektFeedback("empty_query", {
      title: "Wykluczenia niedostępne",
      message: `Lista nie została pokazana - bez wykluczeń mogłaby zawierać produkty celowo pomijane. ${message}`,
      hint: "Odśwież stronę lub spróbuj ponownie za chwilę.",
    });
    return { ok: false, feedback };
  }
  const exclusions = exclusionsSettled.value;

  if (!onRequestsSettled.ok) {
    const message = userFacingErrorText(
      onRequestsSettled.error,
      "Nie udało się wczytać listy „tylko na prośbę”."
    );
    const feedback = getSubiektFeedback("empty_query", {
      title: "Lista „tylko na prośbę” niedostępna",
      message: `Lista nie została pokazana - bez flagi mogłyby wejść produkty zamawiane wyłącznie na prośbę. ${message}`,
      hint: "Odśwież stronę lub spróbuj ponownie za chwilę.",
    });
    return { ok: false, feedback };
  }
  const onRequests = onRequestsSettled.value;

  if (!packagingSettled.ok) {
    const message = userFacingErrorText(
      packagingSettled.error,
      "Nie udało się wczytać ustawień opakowań."
    );
    const feedback = getSubiektFeedback("empty_query", {
      title: "Opakowania niedostępne",
      message: `Lista nie została pokazana - bez opakowań qty ZD mogłoby być w sztukach zamiast paczek. ${message}`,
      hint: "Odśwież stronę lub spróbuj ponownie za chwilę.",
    });
    return { ok: false, feedback };
  }
  const packaging = packagingSettled.value;

  // Min stock — soft fail (bez minimum lista działa, po prostu bez dobijania).
  const minStock = minStockSettled.ok ? minStockSettled.value : [];
  const minStockByTwIdOwn = minStockRowsToMap(minStock);

  if (!productPairsSettled.ok) {
    const message = userFacingErrorText(
      productPairsSettled.error,
      "Nie udało się wczytać mapy par montaż/demontaż."
    );
    const feedback = getSubiektFeedback("empty_query", {
      title: "Pary kompletów niedostępne",
      message: `Lista nie została pokazana - bez mapy par pack i piece mogłyby dostać niezależne qty (podwójne zamówienie). ${message}`,
      hint: "Odśwież stronę lub spróbuj ponownie za chwilę.",
    });
    return { ok: false, feedback };
  }
  const productPairs = productPairsSettled.value;
  // Minimum z wiersza sztuki pary liczy się na paczce (ścieżki czytające mapę po tw paczki).
  const minStockByTwId = withPairMinStock(minStockByTwIdOwn, productPairs);

  if (!productBomsSettled.ok) {
    const message =
      productBomsSettled.error instanceof Error
        ? productBomsSettled.error.message
        : ZD_BOM_UI.loadError;
    const feedback = getSubiektFeedback("empty_query", {
      title: ZD_BOM_UI.estimateBlockedTitle,
      message: ZD_BOM_UI.estimateBlockedMessage(message),
      hint: "Odśwież stronę lub spróbuj ponownie za chwilę.",
    });
    return { ok: false, feedback };
  }
  const productBoms = productBomsSettled.value;

  if (!teethSettled.ok) {
    const message = userFacingErrorText(
      teethSettled.error,
      "Nie udało się wczytać katalogu produktów zębowych."
    );
    const feedback = getSubiektFeedback("empty_query", {
      title: "Produkty zębowe niedostępne",
      message: `Lista nie została pokazana - bez katalogu zębów pozycje zębowe mogłyby trafić na ZD. ${message}`,
      hint: "Odśwież stronę lub sprawdź tabelę produktów zębowych w adminie.",
    });
    return { ok: false, feedback };
  }
  const teethTwIds = [...teethSettled.value];

  const bomRefs = bomRowsToRefs(productBoms);

  const presentTw = new Set(
    fetched.pozycje.map((p) => Math.trunc(Number(p.tw_Id) || 0)).filter((id) => id > 0)
  );
  const missingPartnerTwIds = new Set<number>();
  const partnerIdsToFetch: number[] = [];
  for (const pair of productPairs) {
    const hasPack = presentTw.has(pair.packTwId);
    const hasPiece = presentTw.has(pair.pieceTwId);
    if (hasPack === hasPiece) continue;
    const need = hasPack ? pair.pieceTwId : pair.packTwId;
    if (!partnerIdsToFetch.includes(need)) partnerIdsToFetch.push(need);
    missingPartnerTwIds.add(need);
  }

  const bomIdsToFetch = collectMissingZdBomTwIds(
    fetched.pozycje.map((p) => ({ tw_Id: Math.trunc(Number(p.tw_Id) || 0) })),
    bomRefs
  );
  const missingBomTwIds = new Set<number>(bomIdsToFetch);

  let pendingIndividuals: ZdEstimatePendingIndividualOrder[] | null = null;
  let pendingIndividualsTruncated = false;
  let pendingIndividualsError: string | null = null;
  const individualTwIdsToFetch: number[] = [];
  const supplierIdForIndividuals = String(input.supplierId ?? "").trim();
  if (supplierIdForIndividuals) {
    try {
      const pendingRes = await fetchZdEstimatePendingIndividualOrders(
        supplierIdForIndividuals
      );
      pendingIndividuals = pendingRes.orders;
      pendingIndividualsTruncated = pendingRes.truncated;
      if (pendingIndividuals.length) {
        const mikranByTw = new Map<number, string>();
        for (const p of fetched.pozycje) {
          const tw = Math.trunc(Number(p.tw_Id) || 0);
          const plu = String(
            (p as { tw_PLU?: unknown }).tw_PLU ??
              (p as { Tw_PLU?: unknown }).Tw_PLU ??
              ""
          ).trim();
          if (tw > 0 && plu) mikranByTw.set(tw, plu);
        }
        const previewExtras = buildIndividualEstimateExtras({
          orders: pendingIndividuals,
          lines: fetched.pozycje.map((p) => ({
            tw_Id: Math.trunc(Number(p.tw_Id) || 0),
            tw_Symbol: String(p.tw_Symbol ?? ""),
            tw_Nazwa: String(p.tw_Nazwa ?? ""),
          })),
          pairs: productPairs,
          boms: bomRefs,
          teethTwIds,
          mikranByTw,
        });
        for (const tw of previewExtras.twIdsToFetch) {
          if (!individualTwIdsToFetch.includes(tw)) {
            individualTwIdsToFetch.push(tw);
          }
        }
      }
    } catch (e) {
      pendingIndividuals = null;
      pendingIndividualsTruncated = false;
      pendingIndividualsError =
        e instanceof Error
          ? `Nie wczytano próśb przy Policz: ${e.message}`
          : "Nie wczytano próśb przy Policz.";
    }
  } else {
    pendingIndividuals = [];
  }

  const idsToFetch = [
    ...new Set([...partnerIdsToFetch, ...bomIdsToFetch, ...individualTwIdsToFetch]),
  ];

  touchProgress({ phase: "enrich" });

  const mergedPozycje = [...fetched.pozycje];
  // Równolegle (limit), merge w kolejności idsToFetch — jak pętla sekwencyjna.
  const fetchedExtras = await mapPool(
    idsToFetch,
    ZD_ESTIMATE_MISSING_SKU_FETCH_CONCURRENCY,
    async (towarId) => {
      try {
        return await fetchSubiektZdEstimateAll({
          towarId,
          dniZapasu,
          dataOd,
          dataDo,
          zapasMin: zapasMin > 0 ? zapasMin : undefined,
          tylkoBraki: false,
          maxPages: 2,
        });
      } catch {
        // Pusta odpowiedź / timeout jednego SKU: zostaje w missing*.
        // Pary → qty 0 + banner; explode BOM → osobny gate Create.
        // Nie zrywamy całego Policz — reszta zakresu ma zostać na liście.
        return null;
      }
    }
  );
  for (const one of fetchedExtras) {
    if (!one) continue;
    for (const row of one.pozycje) {
      const id = Math.trunc(Number(row.tw_Id) || 0);
      if (!(id > 0) || presentTw.has(id)) continue;
      mergedPozycje.push(row);
      presentTw.add(id);
      missingPartnerTwIds.delete(id);
      missingBomTwIds.delete(id);
    }
  }

  // Zaległe ZD (po terminie) nie są „w drodze” — inaczej jedno martwe ZD zerowało Do ZD miesiącami.
  {
    const staleByTw = await loadStaleOpenZdByTwId(
      mergedPozycje.map((p) => Math.trunc(Number(p.tw_Id) || 0)),
      dataDo
    ).catch((e: unknown) => {
      console.warn("[zd-order-engine] zaległe ZD", e);
      return new Map<number, ZdStaleOpenZd>();
    });
    for (let i = 0; i < mergedPozycje.length && staleByTw.size; i += 1) {
      const stale = staleByTw.get(Math.trunc(Number(mergedPozycje[i]!.tw_Id) || 0));
      if (stale) mergedPozycje[i] = applyStaleOpenZdToLine(mergedPozycje[i]!, stale);
    }
  }

  // Jedna historia: zakres główny + dociągnięte partner/BOM/prośba.
  if (historyFilters) {
    historyByTwId = new Map();
    try {
      const historyTwIds = [
        ...new Set(
          mergedPozycje.map((p) => Math.trunc(Number(p.tw_Id) || 0)).filter((id) => id > 0)
        ),
      ];
      for (const historyScope of historyFilters.scopes) {
        const snapLines = await fetchLatestSnapshotHistoryByTwIds(historyTwIds, {
          supplierKhIds: historyFilters.supplierKhIds,
          scope: historyScope,
          hostKind: historyFilters.hostKind,
        });
        for (const [twId, row] of snapLines) {
          const prev = historyByTwId.get(twId);
          // Kilka zakresów: wygrywa najnowsze ZD.
          if (prev && Date.parse(prev.linkedAt) >= Date.parse(row.linkedAt)) continue;
          historyByTwId.set(twId, {
            lastOrderedQty: row.qty,
            linkedAt: row.linkedAt,
          });
        }
      }
    } catch {
      // Historia opcjonalna dla samego wyliczenia — bez snapshotów lista działa.
      // Fetch error ≠ pusta historia: UI blokuje Create, żeby nie pójść bez cięć.
      historyByTwId = null;
      historyFetchFailed = true;
    }
  }

  // Cover / bake: tylko N + tryb (bez M) — M wchodzi dopiero w packagingLookup → Do ZD.
  const packagingByTwId = new Map<
    number,
    { unitsPerPackage: number; documentUnitMode?: ZdPackagingDocumentUnitMode }
  >();
  for (const row of packaging) {
    packagingByTwId.set(row.subiektTwId, {
      unitsPerPackage: row.unitsPerPackage,
      documentUnitMode: row.documentUnitMode,
    });
  }

  const onRequestIds = onRequestTwIdSet(onRequests, productPairs);
  const hardBasePreview = mergeZdEstimateExcludedTwIds(
    mergedPozycje.map((p) => ({
      tw_Id: Number(p.tw_Id) || 0,
      tw_Nazwa: String(p.tw_Nazwa ?? ""),
      tw_Symbol: String(p.tw_Symbol ?? ""),
    })),
    exclusions.map((e) => e.subiektTwId),
    { teethTwIds }
  );
  const bakeExcludedPreview = buildBakeExcludedTwIds(hardBasePreview, onRequestIds);

  const [boostPreset, extrasPolicy] = await Promise.all([
    fetchZdBoostPowerPreset(),
    fetchZdEstimateExtrasPolicy().catch(() => ZD_ESTIMATE_EXTRAS_POLICY_DEFAULT),
  ]);
  const salesTrackPolicy = policyForBoostPreset(boostPreset);

  // Profil sprzedaży: znaczniki zawsze, wygładzenie przy opcji. Profil jest w jednostkach
  // karty jak sprzedaż. Komplety (BOM) liczą popyt łącznie ze wkładem kompletów, a profil zna
  // tylko własną sprzedaż towaru — bez profilu, żeby znacznik nie przeczył liczbom. Pary dostają
  // profil łączny (niżej), bo ich sprzedaż w tabeli to sztuki + paczki × przelicznik.
  // Prośby odejmujemy tylko bez opakowań (prośba w sztukach, sprzedaż w jednostkach karty).
  // Dni braku w oknie (historia stanów z nocnego przebiegu): sprzedaż przeliczona na dni ze
  // stanem, zanim podłoga / profil / cel ją wezmą. Pary i składy — bez (stan łączony gdzie indziej).
  // Bez historii (pierwsze tygodnie, błąd bazy) — jak dotąd.
  // Zwroty (KFS): Subiekt ich nie odejmuje — sprzedaż w oknie i cel w dół, zanim cokolwiek z nich liczy.
  const correctionsByDay = await loadSalesCorrectionsByDay({
    twIds: mergedPozycje.map((p) => Math.trunc(Number(p.tw_Id) || 0)),
    endDate: dataDo,
  }).catch((e: unknown) => {
    console.warn("[zd-order-engine] korekty KFS", e);
    return new Map<number, Array<readonly [string, number]>>();
  });
  if (correctionsByDay.size) {
    const dniOkresuKfs =
      Number(fetched.parametry.dniOkresu) > 0
        ? Number(fetched.parametry.dniOkresu)
        : Math.round((Date.parse(dataDo) - Date.parse(dataOd)) / 86_400_000) + 1;
    for (let i = 0; i < mergedPozycje.length; i += 1) {
      const days = correctionsByDay.get(Math.trunc(Number(mergedPozycje[i]!.tw_Id) || 0));
      if (!days) continue;
      const pieces = days.reduce((a, [day, q]) => (day >= dataOd && day <= dataDo ? a + q : a), 0);
      mergedPozycje[i] = applySalesCorrectionsToLine(mergedPozycje[i]!, pieces, dniOkresuKfs, dniZapasu, zapasMin);
    }
  }
  // Sprzedaż przed mnożnikiem braków — profil klasyfikuje skok na niej (sprzedaż ×2 wyglądała jak skok i cofała korektę).
  const preStockoutSalesByTw = new Map(
    mergedPozycje.map((p) => [Math.trunc(Number(p.tw_Id) || 0), Math.max(0, Number(p.sprzedazOkres) || 0)])
  );
  {
    const composite = new Set<number>([
      ...productPairs.flatMap((p) => [p.packTwId, p.pieceTwId]),
      ...bomRefs.flatMap((b) => [b.parentTwId, ...b.components.map((c) => c.componentTwId)]),
    ]);
    const windowDays = businessDaysInWindow(dataOd, dataDo);
    const twIds = mergedPozycje.map((p) => Math.trunc(Number(p.tw_Id) || 0)).filter((t) => t > 0 && !composite.has(t));
    const history =
      windowDays > 0 && twIds.length
        ? await loadStockHistoryWindow(twIds, dataOd, dataDo).catch((e) => {
            console.error("[zd-order-engine] historia stanów", e);
            return new Map<number, { recordedDays: number; outDays: number }>();
          })
        : new Map<number, { recordedDays: number; outDays: number }>();
    const metaByTw = new Map<number, NonNullable<ReturnType<typeof computeStockoutSalesFactor>>>();
    for (const [tw, h] of history) {
      if (composite.has(tw)) continue;
      const meta = computeStockoutSalesFactor({ windowDays, recordedDays: h.recordedDays, outDays: h.outDays });
      if (meta) metaByTw.set(tw, meta);
    }
    // Sprzedaż pod prośby nie dostaje mnożnika. Prośba jest w sztukach karty — tak samo jak
    // sprzedaż z API i jak liczy ją `individualExtra` (opakowanie przelicza tylko jednostki ZD).
    const prosbaForStockout = metaByTw.size
      ? await loadDeliveredProsbaPiecesByTwId({
          twIds: [...metaByTw.keys()],
          dataOd,
          dataDo,
        }).catch(() => new Map<number, number>())
      : new Map<number, number>();
    for (let i = 0; i < mergedPozycje.length; i += 1) {
      const tw = Math.trunc(Number(mergedPozycje[i]!.tw_Id) || 0);
      const meta = metaByTw.get(tw);
      if (!meta) continue;
      const effective = stockoutMetaExcludingProsba(
        meta,
        Number(mergedPozycje[i]!.sprzedazOkres) || 0,
        prosbaForStockout.get(tw) ?? 0
      );
      if (effective) mergedPozycje[i] = applyStockoutAdjustToLine(mergedPozycje[i]!, effective, zapasMin);
    }
  }

  let salesSmoothing: ZdSalesSmoothingSummary | null = null;
  /** Linie przed podłogą strategii — „jak dotąd” liczone z tego samego pobrania (porównanie). */
  const classicBase: typeof mergedPozycje | null =
    input.compareClassic && orderPolicy.strategy !== "classic" ? mergedPozycje.slice() : null;
  {
    const profilesReady = Promise.all([primaryProfiles, extraProfiles]);
    // Profil z bazy jest gotowy od razu — etap „profil” tylko, gdy naprawdę liczymy.
    const readyFast = await Promise.race([
      profilesReady.then(() => true),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 300)),
    ]);
    if (!readyFast) touchProgress({ phase: "profile", message: null });
    const [p1, p2] = await profilesReady;
    // Błąd któregokolwiek zakresu = komunikat (część listy byłaby bez wygładzenia).
    const anyFailed = p1 == null || (extraScopes.length > 0 && p2 == null);
    if (!p1 && !p2) {
      salesSmoothing = { spike: 0, rare: 0, prosba: 0, failed: true };
    } else {
      const profiles = new Map([...(p2 ?? []), ...(p1 ?? [])]);
      // Zwroty także z okien profilu — podłoga 90 d i znaczniki na sprzedaży netto.
      for (const [tw, days] of correctionsByDay) {
        const w = profiles.get(tw);
        if (w) profiles.set(tw, subtractCorrectionsFromWindows(w, days, dataDo));
      }
      const compositeTwIds = new Set<number>();
      for (const pair of productPairs) {
        compositeTwIds.add(pair.packTwId);
        compositeTwIds.add(pair.pieceTwId);
      }
      for (const bom of bomRefs) {
        compositeTwIds.add(bom.parentTwId);
        for (const c of bom.components) compositeTwIds.add(c.componentTwId);
      }
      // Pełny brak w oknie (stan 0, sprzedaż 0): tempo z profilu sprzed okna — inaczej towar znika z listy i z radaru.
      {
        const dniOkresuFb =
          Number(fetched.parametry.dniOkresu) > 0
            ? Number(fetched.parametry.dniOkresu)
            : Math.round((Date.parse(dataDo) - Date.parse(dataOd)) / 86_400_000) + 1;
        for (let i = 0; i < mergedPozycje.length; i += 1) {
          const tw = Math.trunc(Number(mergedPozycje[i]!.tw_Id) || 0);
          if (compositeTwIds.has(tw)) continue;
          mergedPozycje[i] = applyZdStockoutFallbackToLine(mergedPozycje[i]!, profiles.get(tw), {
            dniOkresu: dniOkresuFb,
            dniZapasu,
            zapasMin,
          });
        }
      }
      // Strategia max30_90 zastępuje wygładzenie (backtest: wygładzenie nie poprawiało wyniku).
      const smoothing = input.salesSmoothing === true && orderPolicy.strategy === "classic";
      // Sprzedaż pod prośbę była już zamówiona jako dodatek do prośby — nie jest popytem na zapas.
      // Strategia zastępuje wygładzenie, ale odejmowanie próśb musi zostać (inaczej podłoga 90 d
      // ciągnie jednorazową prośbę jeszcze przez dwa miesiące).
      const strategyActive = orderPolicy.strategy !== "classic";
      const subtractProsba = smoothing || strategyActive;
      // Prośba jest w sztukach karty jak sprzedaż z API (opakowanie przelicza tylko jednostki ZD) —
      // towary z opakowaniem też; dawniej pomijane, więc prośba 500 szt siedziała w celu i w podłodze 90 d.
      const prosbaInPieces = (tw: number) => subtractProsba && !compositeTwIds.has(tw);
      const prosbaLoadTwIds = mergedPozycje.map((p) => Math.trunc(Number(p.tw_Id) || 0)).filter(prosbaInPieces);
      const [prosbaPieces, prosbaByFloorWindow] = await Promise.all([
        subtractProsba
          ? loadDeliveredProsbaPiecesByTwId({ twIds: prosbaLoadTwIds, dataOd, dataDo }).catch(() => new Map<number, number>())
          : new Map<number, number>(),
        // Podłoga 90 d: prośby z każdego z jej trzech okien profilu, nie tylko z okna Kreatora.
        // shortcut: okna liczone od dataDo — profil „usable” w Kreatorze (do 14 d starszy) przesuwa je o tyle; nocny przebieg ma świeży.
        strategyActive
          ? loadDeliveredProsbaPiecesByFloorWindow({ twIds: prosbaLoadTwIds, endDate: dataDo }).catch(
              () => new Map<number, number[]>()
            )
          : new Map<number, number[]>(),
      ]);
      const dniOkresu =
        Number(fetched.parametry.dniOkresu) > 0
          ? Number(fetched.parametry.dniOkresu)
          : Math.round((Date.parse(dataDo) - Date.parse(dataOd)) / 86_400_000) + 1;
      salesSmoothing = { spike: 0, rare: 0, prosba: 0, failed: anyFailed };
      // Para to jeden popyt (sztuki + paczki × przelicznik): podłoga i profil liczone dla pary,
      // nie dla każdej strony osobno (inaczej max(paczki) + max(sztuki) zawyżałby cel).
      const pairTwIds = new Set(productPairs.flatMap((p) => [p.packTwId, p.pieceTwId]));
      // „Składamy”: popyt zestawu schodzi na składniki (sprzedaż × ilość). Podłoga per linia
      // dałaby max(składnik) + ilość × max(zestaw) — liczymy ją raz, na łącznym popycie składnika.
      const explodeBoms = bomRefs.filter(
        (b) => normalizeDemandAllocation(b.demandAllocation) === "explode" && b.components.length > 0
      );
      const explodeParentIds = new Set(explodeBoms.map((b) => b.parentTwId));
      const rawSalesByTw = new Map(
        mergedPozycje.map((p) => [Math.trunc(Number(p.tw_Id) || 0), Number(p.sprzedazOkres) || 0])
      );
      // Najpierw łączna podłoga składników; składnik bez niej (brak profilu zestawu, zestaw spoza
      // zakresu) dostaje własną podłogę per linia — inaczej traciłby ją całkiem.
      const bomFloored = applyZdBomDemandFloor({
        lines: mergedPozycje,
        explodeBoms,
        profiles,
        rawSalesByTw,
        pairTwIds,
        policy: orderPolicy,
        dniOkresu,
        dniZapasu,
      });
      for (let i = 0; i < mergedPozycje.length; i += 1) {
        const line = mergedPozycje[i]!;
        const tw = Math.trunc(Number(line.tw_Id) || 0);
        const windows = profiles.get(tw);
        // Strategia odjęła prośby / ścięła skok — meta z tego kroku zostaje (drugi przebieg bez
        // wygładzenia nadpisałby ją „bez zmian”, a liczby już są po zmianie).
        let prosbaMetaKept = false;
        if (
          windows &&
          strategyActive &&
          !pairTwIds.has(tw) &&
          !explodeParentIds.has(tw) &&
          !bomFloored.has(tw)
        ) {
          let base = line;
          if (!compositeTwIds.has(tw)) {
            // Jednorazowy skok liczony jak typowy miesiąc — cel strategii (cykl + dostawa + bufor) zamawiałby
            // go prawie w całości. Rzadka sprzedaż bez zmian (tę trzyma podłoga 90 d).
            const pm = resolveZdSalesProfile({
              windows,
              sprzedazOkres: preStockoutSalesByTw.get(tw) ?? (Number(line.sprzedazOkres) || 0),
              dniOkresu,
              prosbaPieces: prosbaPieces.get(tw) ?? 0,
              smoothing: true,
              smoothKinds: ["spike"],
            });
            if (pm.applied) {
              // smoothing: false — jak dotąd przy samych prośbach: cięcia z historii ZD i podbicia bez zmian
              // (backtest liczy je tak samo).
              base = applyZdSalesProfileToLine(line, { ...pm, smoothing: false }, zapasMin);
              if (pm.prosbaPieces > 0) salesSmoothing.prosba += 1;
              if (pm.kind === "spike") salesSmoothing.spike += 1;
              prosbaMetaKept = true;
            }
          }
          const floored = applyZdDemandFloorToLine(base, {
            policy: orderPolicy,
            sales90: sales90CappedFromProfile(windows, prosbaByFloorWindow.get(tw)),
            dniOkresu,
            dniZapasu,
          });
          if (floored !== line) {
            mergedPozycje[i] = floored;
          }
        }
        if (!windows || compositeTwIds.has(tw) || prosbaMetaKept) continue;
        const meta = resolveZdSalesProfile({
          windows,
          // Profil (znaczniki) z prawdziwej sprzedaży, nie z podłogi strategii.
          sprzedazOkres: preStockoutSalesByTw.get(tw) ?? (Number(line.sprzedazOkres) || 0),
          dniOkresu,
          prosbaPieces: prosbaPieces.get(tw) ?? 0,
          smoothing,
        });
        mergedPozycje[i] = applyZdSalesProfileToLine(mergedPozycje[i]!, meta, zapasMin);
        if (meta.applied) {
          if (meta.kind === "spike") salesSmoothing.spike += 1;
          else if (meta.kind === "rare") salesSmoothing.rare += 1;
          if (meta.prosbaPieces > 0) salesSmoothing.prosba += 1;
        }
      }
      const indexByTw = new Map(mergedPozycje.map((p, idx) => [Math.trunc(Number(p.tw_Id) || 0), idx]));
      const bomTwIds = new Set(bomRefs.flatMap((b) => [b.parentTwId, ...b.components.map((c) => c.componentTwId)]));
      for (const pair of productPairs) {
        const packIdx = indexByTw.get(pair.packTwId);
        if (packIdx == null) continue;
        const pieceIdx = indexByTw.get(pair.pieceTwId);
        const packW = profiles.get(pair.packTwId);
        const pieceW = pieceIdx != null ? profiles.get(pair.pieceTwId) : undefined;
        // Strona pary na liście bez profilu (inny zakres) — wykres i podłoga zaniżyłyby sprzedaż.
        if (!packW || (pieceIdx != null && !pieceW)) continue;
        const ratio = Math.max(1, Number(pair.unitsPerPack) || 1);
        const windows = packW.map((v, k) => Math.max(0, pieceW?.[k] ?? 0) + Math.max(0, v) * ratio);
        const rawSales =
          Math.max(0, rawSalesByTw.get(pair.packTwId) ?? 0) * ratio +
          (pieceIdx != null ? Math.max(0, rawSalesByTw.get(pair.pieceTwId) ?? 0) : 0);
        // Profil łączny na wierszu paczki (sprzedaż pary w tabeli jest łączna). Para w komplecie
        // (BOM) bez profilu: jej sprzedaż ma wkład kompletów, którego profil nie zna.
        if (!bomTwIds.has(pair.packTwId) && !bomTwIds.has(pair.pieceTwId)) {
          const meta = resolveZdSalesProfile({ windows, sprzedazOkres: rawSales, dniOkresu, prosbaPieces: 0, smoothing: false });
          mergedPozycje[packIdx] = { ...mergedPozycje[packIdx]!, salesProfile: meta };
        }
        const floored = applyZdPairDemandFloor({
          policy: orderPolicy,
          pack: mergedPozycje[packIdx]!,
          piece: pieceIdx != null ? mergedPozycje[pieceIdx]! : null,
          unitsPerPack: ratio,
          sales90: sales90CappedFromProfile(windows),
          dniOkresu,
        });
        if (!floored) continue;
        // Krok „Dlaczego tyle” w sztukach pary, na wierszu paczki (scalony wiersz go przejmuje).
        mergedPozycje[packIdx] = { ...floored.pack, demandFloor: floored.floor };
        if (pieceIdx != null && floored.piece) mergedPozycje[pieceIdx] = floored.piece;
      }
    }
  }

  touchProgress({ phase: "compose" });
  const result = buildManualZdEstimateResult(fetched.parametry, mergedPozycje, {
    onlyManualBraki: false,
    // Strategia: jednorazowy skok tnie profil 12 × 30 d; „skok vs ostatnie ZD” liczyłby oczekiwane na innych dniach zapasu.
    historySpikeCut: orderPolicy.strategy === "classic",
    historyByTwId,
    packagingByTwId,
    productPairs,
    productBoms: bomRefs,
    missingPartnerTwIds,
    missingBomTwIds,
    excludedTwIds: bakeExcludedPreview,
    zapasMin,
    salesTrackPolicy,
    minStockByTwId,
  });

  // „Jak dotąd”: Subiekt liczył cel na dniach strategii (cel ≈ tempo × dni + zapasMin),
  // więc przeliczamy go na dni wywołującego; reszta reguł (historia, pary, BOM) ta sama.
  const classicDays = input.dniZapasu;
  const dniOkresuCompare =
    Number(fetched.parametry.dniOkresu) > 0
      ? Number(fetched.parametry.dniOkresu)
      : Math.round((Date.parse(dataDo) - Date.parse(dataOd)) / 86_400_000) + 1;
  const classicResult = classicBase
    ? buildManualZdEstimateResult(
        // „Jak dotąd” na dniach dłuższych niż karta: korekty na dniach karty, jak w biegu classic.
        {
          ...fetched.parametry,
          dniZapasu: classicDays,
          dniZapasuSygnaly: resolveZdRunDniZapasu({
            policy: ZD_SUPPLIER_ORDER_POLICY_CLASSIC,
            dniZapasu: classicDays,
            normalDniZapasu: input.normalDniZapasu,
          }).signalDniZapasu,
        },
        classicBase.map((l) => {
          const rate = Math.max(0, Number(l.sprzedazOkres) || 0) / Math.max(1, dniOkresuCompare);
          // Zaokrąglenie do 1e-6: szum zmiennoprzecinkowy przesuwał progi podążania za sprzedażą.
          const cel = Math.max(0, (Number(l.celZapasu) || 0) + rate * (classicDays - dniZapasu));
          return { ...l, celZapasu: Math.round(cel * 1e6) / 1e6 };
        }),
        {
          onlyManualBraki: false,
          historySpikeCut: true,
          historyByTwId,
          packagingByTwId,
          productPairs,
          productBoms: bomRefs,
          missingPartnerTwIds,
          missingBomTwIds,
          excludedTwIds: bakeExcludedPreview,
          zapasMin,
          salesTrackPolicy,
          minStockByTwId,
        }
      )
    : null;

  // Towary ze wspólnego zakresu przypisane innemu dostawcy znikają z listy.
  // Para znika tylko w całości (obie strony przypisane gdzie indziej) — inaczej
  // przeliczenie paczka/sztuka straciłoby partnera. Zostają komplety (BOM)
  // i towary z prośbą tego dostawcy.
  const assignedElsewhere: ZdOrderAssignedElsewhere[] = [];
  if (input.supplierId) {
    const assignments = await loadZdProductAssignments(
      result.pozycje.flatMap((p) => (p.pair ? [p.tw_Id, p.pair.twinTwId] : [p.tw_Id]))
    );
    const prosbaTwIds = new Set(
      (pendingIndividuals ?? []).map((o) => o.subiektTwId).filter((t): t is number => t != null)
    );
    const hidden = new Set<number>();
    for (const line of result.pozycje) {
      const a = assignments.get(line.tw_Id);
      if (!a || a.supplierId === input.supplierId) continue;
      if (line.bom || prosbaTwIds.has(line.tw_Id)) continue;
      if (line.pair) {
        const twin = assignments.get(line.pair.twinTwId);
        if (!twin || twin.supplierId === input.supplierId) continue;
      }
      hidden.add(line.tw_Id);
      assignedElsewhere.push({
        twId: line.tw_Id,
        twSymbol: line.tw_Symbol || null,
        twNazwa: line.tw_Nazwa,
        supplierId: a.supplierId,
      });
    }
    if (hidden.size) {
      result.pozycje = result.pozycje.filter((p) => !hidden.has(p.tw_Id));
      result.pozycjeBase = result.pozycjeBase.filter((p) => !hidden.has(p.tw_Id));
      if (classicResult) {
        classicResult.pozycje = classicResult.pozycje.filter((p) => !hidden.has(p.tw_Id));
        classicResult.pozycjeBase = classicResult.pozycjeBase.filter((p) => !hidden.has(p.tw_Id));
      }
    }
  }

  // Pamięć korekt (dziennik decyzji): towar, który 3 z 4 ostatnich razy podnosiłeś / obniżałeś, dostaje
  // cel × mediana Twoich korekt; zdejmowany z listy — znacznik. Bez dziennika lista jak dotąd.
  if (input.supplierId) {
    const patterns = await loadZdLineDecisionPatterns({
      supplierId: input.supplierId,
      twIds: result.pozycje.map((p) => p.tw_Id),
    }).catch((e: unknown) => {
      console.warn("[zd-order-engine] pamięć korekt", e);
      return new Map<number, ZdLineDecisionPattern>();
    });
    if (patterns.size) {
      // Pary i składy liczą ilość na scalonym wierszu — pamięć korekt tylko na zwykłych kartach (w bazie i w wyniku tak samo).
      const compositeTw = new Set<number>([
        ...productPairs.flatMap((p) => [p.packTwId, p.pieceTwId]),
        ...bomRefs.flatMap((b) => [b.parentTwId, ...b.components.map((c) => c.componentTwId)]),
      ]);
      const applyTo = (lines: ManualZdEstimateLine[]) =>
        lines.map((line) => {
          const p = patterns.get(line.tw_Id);
          if (!p || compositeTw.has(line.tw_Id)) return line;
          const pack = packagingByTwId.get(line.tw_Id);
          return applyUserPatternToManualLine(line, p, {
            zapasMin,
            otwarteZdPieces: zdDocumentUnitsToPieces(line.otwarteZd, pack?.unitsPerPackage, pack?.documentUnitMode),
            minStockSzt: minStockByTwId.get(line.tw_Id),
          });
        });
      result.pozycje = applyTo(result.pozycje);
      result.pozycjeBase = applyTo(result.pozycjeBase);
    }
  }

  // Podpowiedzi (bez nich lista działa): ostatnie ZD u innego dostawcy, prośby na te towary
  // przypisane innemu dostawcy, prośby tego dostawcy czekające na uzupełnienie.
  const otherSupplierHintByTwId: Record<number, string> = {};
  const prosbyElsewhereByTwId: Record<number, ZdProsbaElsewhere[]> = {};
  let incompleteProsbyCount: number | null = null;
  if (input.supplierId) {
    const supplierId = input.supplierId;
    const [last, elsewhere, incomplete] = await Promise.all([
      loadLastZdSupplierByTwIds(result.pozycje.map((p) => p.tw_Id)).catch(() => null),
      loadProsbyElsewhereByTwIds({ supplierId, lines: result.pozycje }).catch(() => null),
      countIncompleteProsbyForSupplier(supplierId).catch(() => null),
    ]);
    for (const [tw, hit] of last ?? []) {
      if (hit.supplierId !== supplierId) otherSupplierHintByTwId[tw] = hit.supplierName;
    }
    for (const [tw, list] of elsewhere ?? []) prosbyElsewhereByTwId[tw] = list;
    incompleteProsbyCount = incomplete;
  }

  const hardBase = mergeZdEstimateExcludedTwIds(
    result.pozycje,
    exclusions.map((e) => e.subiektTwId),
    { teethTwIds }
  );
  const packagingLookup = new Map<number, PackagingLookup>();
  for (const row of packaging) {
    packagingLookup.set(row.subiektTwId, {
      unitsPerPackage: row.unitsPerPackage,
      packageLabel: row.packageLabel,
      documentUnitMode: row.documentUnitMode,
      orderMultiple: row.orderMultiple,
    });
  }
  for (const pair of productPairs) {
    const existing = packagingLookup.get(pair.packTwId);
    packagingLookup.set(pair.packTwId, {
      unitsPerPackage: pair.unitsPerPack,
      packageLabel: existing?.packageLabel ?? "op.",
      documentUnitMode: "packages",
      orderMultiple: existing?.orderMultiple ?? null,
    });
  }
  let prosbaReservedByTwId: Map<number, ZdEstimateReservedOverlapSlice[]> | null = null;
  let prosbaOverlapCandidateTwIds: number[] | undefined;
  let prosbaOverlapResolved = false;
  let individualExtraLookup: Map<number, number> | null = null;
  let individualStockNeedRelief: Map<number, number> | null = null;
  let individualExtraOverlap: Map<number, number> | null = null;
  let individualExtraRawForLift: Map<number, number> | null = null;

  if (pendingIndividuals?.length) {
    const mikranByTw = new Map<number, string>();
    for (const p of result.pozycje) {
      const plu = String(p.tw_PLU ?? "").trim();
      if (p.tw_Id > 0 && plu) mikranByTw.set(p.tw_Id, plu);
    }
    const extras = buildIndividualEstimateExtras({
      orders: pendingIndividuals,
      lines: result.pozycje,
      pairs: productPairs,
      boms: bomRefs,
      teethTwIds,
      mikranByTw,
    });
    const rawMap = individualExtraPiecesMap(extras);
    individualExtraRawForLift = rawMap.size ? rawMap : null;

    if (rawMap.size) {
      const overlap = await resolveIndividualExtrasWithReservationOverlap({
        byTwId: extras.byTwId,
        lines: result.pozycje,
        reservationSources: buildZdOverlapReservationSources({
          pairs: productPairs,
          boms: bomRefs,
          dostepneByTw: new Map(result.pozycjeBase.map((l) => [l.tw_Id, Number(l.dostepne) || 0])),
        }),
      });
      prosbaOverlapCandidateTwIds = overlap.candidateTwIds;
      prosbaOverlapResolved = overlap.resolved;
      if (overlap.reservedByTwId.size) {
        prosbaReservedByTwId = overlap.reservedByTwId;
      }
      individualExtraLookup = overlap.rawExtraByTwId.size ? overlap.rawExtraByTwId : null;
      individualStockNeedRelief = overlap.stockNeedReliefByTwId.size
        ? overlap.stockNeedReliefByTwId
        : null;
      individualExtraOverlap = overlap.extraOverlapByTwId.size
        ? overlap.extraOverlapByTwId
        : null;
    } else {
      prosbaOverlapCandidateTwIds = [];
      prosbaOverlapResolved = true;
    }
  } else if (pendingIndividuals) {
    // Pusta lista próśb — overlap zbędny.
    prosbaOverlapCandidateTwIds = [];
    prosbaOverlapResolved = true;
  }

  // Lift on-request: zawsze z RAW extras (nie z overlap), żeby pełny overlap
  // nie wrzucał prośby do usług „excluded”.
  const extraOnlyTwIds = buildExtraOnlyTwIds(
    onRequestIds,
    individualExtraRawForLift,
    productPairs
  );
  const orderExcluded = buildOrderExcludedTwIds(hardBase, onRequestIds, extraOnlyTwIds);

  const packAfter = summarizePackOrderQty(
    result.pozycje,
    packagingLookup,
    orderExcluded,
    individualExtraLookup,
    null,
    extraOnlyTwIds,
    extrasPolicy,
    individualStockNeedRelief,
    individualExtraOverlap,
    minStockByTwId
  );
  // Surowy KPI: bez wykluczeń i bez trybu extra_only (pełny stock+extra).
  const packRaw = summarizePackOrderQty(
    result.pozycje,
    packagingLookup,
    null,
    individualExtraLookup,
    null,
    null,
    extrasPolicy,
    individualStockNeedRelief,
    individualExtraOverlap,
    minStockByTwId
  );
  // Jak filtr „Wykluczone” w UI — orderExcluded (soft bez prośby + hard), nie bake.
  const excludedInGroupCount = result.pozycje.filter((p) => orderExcluded.has(p.tw_Id)).length;

  return {
    ok: true,
    result,
    scopesIncluded,
    assignedElsewhere,
    otherSupplierHintByTwId,
    prosbyElsewhereByTwId,
    incompleteProsbyCount,
    fetch: {
      pagesFetched: fetched.pagesFetched,
      totalCountApi: fetched.totalCountApi,
      truncated: fetched.truncated,
    },
    historyByTwId,
    historyFetchFailed,
    pendingIndividuals,
    pendingIndividualsTruncated,
    pendingIndividualsError,
    salesSmoothing,
    prosbaReservedByTwId,
    prosbaOverlapCandidateTwIds,
    prosbaOverlapResolved,
    exclusions,
    onRequests,
    packaging,
    minStock,
    minStockByTwId,
    productPairs,
    productBoms,
    bomRefs,
    teethTwIds,
    boostPreset,
    orderPolicy,
    dniZapasuUsed: dniZapasu,
    classicResult,
    extrasPolicy,
    hardExcludedTwIds: hardBase,
    onRequestTwIds: onRequestIds,
    packagingLookup,
    missingPartnerTwIds,
    missingBomTwIds,
    kpi: {
      doZamowieniaCount: packAfter.doZamowieniaCount,
      zdUnitsSuma: packAfter.zdUnitsSuma,
      doZamowieniaCountRaw: packRaw.doZamowieniaCount,
      zdUnitsSumaRaw: packRaw.zdUnitsSuma,
      excludedInGroupCount,
    },
  };
}
