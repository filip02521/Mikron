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
  type ZdEstimateHistoryScope,
} from "@/lib/data/zd-estimate-order-snapshots";
import { createAdminClient } from "@/lib/supabase/admin";
import { listZdEstimateSupplierScopesFor } from "@/lib/data/zd-estimate-supplier-scopes";
import {
  loadLastZdSupplierByTwIds,
  loadZdProductAssignments,
} from "@/lib/data/zd-scope-order";
import {
  fetchSubiektZdEstimateAll,
  fetchSubiektZdEstimateZkPage,
} from "@/lib/subiekt/api";
import { requireZdEstimateSnapshotHostKind } from "@/lib/subiekt/config";
import { getSubiektFeedback, type SubiektFeedback } from "@/lib/subiekt/feedback";
import { assertZdEstimateFilterEcho } from "@/lib/orders/zd-estimate-scope";
import type { ZdEstimateRunProgressSnapshot } from "@/lib/orders/zd-estimate-run-progress";
import { fetchAllReservedZkRowsForTwId } from "@/lib/orders/zd-estimate-reservations";
import {
  collectTwIdsNeedingProsbaReservationOverlap,
  collectTwIdsNeedingProsbaReservationOverlapWithoutStanRez,
  individualExtrasAndReliefWithReservationOverlap,
  reservedRowsToOverlapSlices,
  type ZdEstimateProsbaOverlapContribution,
  type ZdEstimateReservedOverlapSlice,
} from "@/lib/orders/zd-estimate-prosba-reservation-overlap";

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


const ZD_ESTIMATE_PROSBA_OVERLAP_CONCURRENCY = 4;

export async function fetchReservedOverlapSlicesByTwIds(
  twIds: readonly number[]
): Promise<{
  reservedByTwId: Map<number, ZdEstimateReservedOverlapSlice[]>;
  /** true gdy którykolwiek tw rzucił — nie cache'uj skip w UI. */
  hadFetchErrors: boolean;
}> {
  const unique = [
    ...new Set(
      twIds
        .map((id) => Math.trunc(Number(id)) || 0)
        .filter((id) => id > 0)
    ),
  ];

  const out = new Map<number, ZdEstimateReservedOverlapSlice[]>();
  if (!unique.length) {
    return { reservedByTwId: out, hadFetchErrors: false };
  }

  let hadFetchErrors = false;
  for (let i = 0; i < unique.length; i += ZD_ESTIMATE_PROSBA_OVERLAP_CONCURRENCY) {
    const chunk = unique.slice(i, i + ZD_ESTIMATE_PROSBA_OVERLAP_CONCURRENCY);
    const results = await Promise.all(
      chunk.map(async (twId) => {
        try {
          const fetched = await fetchAllReservedZkRowsForTwId({
            twId,
            fetchPage: fetchSubiektZdEstimateZkPage,
          });
          return {
            twId,
            slices: reservedRowsToOverlapSlices(fetched.rows),
            ok: true as const,
          };
        } catch {
          return {
            twId,
            slices: [] as ZdEstimateReservedOverlapSlice[],
            ok: false as const,
          };
        }
      })
    );
    for (const r of results) {
      if (!r.ok) hadFetchErrors = true;
      if (r.slices.length) out.set(r.twId, r.slices);
    }
  }
  return { reservedByTwId: out, hadFetchErrors };
}

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

  const candidateTwIds = input.lines?.length
    ? collectTwIdsNeedingProsbaReservationOverlap({
        extraTwIds: rawMap.keys(),
        lines: input.lines,
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
    const fetched = await fetchReservedOverlapSlicesByTwIds(toFetch);
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
    "phase" | "pagesCommitted" | "totalPages" | "totalCountApi" | "linesSoFar"
  >
>;

export type ZdOrderEngineInput = {
  scope:
    | { mode: "grupa"; grupaId: number; cechaId: null }
    | { mode: "cecha"; grupaId: null; cechaId: number };
  /** Dostawca OnTime — historia snapshotów (kh + aliasy) i prośby. Bez → bez historii i próśb. */
  supplierId: string | null;
  dniZapasu: number;
  dataOd: string;
  dataDo: string;
  zapasMin: number;
  ordersBaseUrl: string;
  onProgress?: (patch: ZdOrderEngineProgressPatch) => void;
};

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
  fetch: { pagesFetched: number; totalCountApi: number; truncated: boolean };
  historyByTwId: Map<number, { lastOrderedQty: number; linkedAt: string }> | null;
  historyFetchFailed: boolean;
  pendingIndividuals: ZdEstimatePendingIndividualOrder[] | null;
  pendingIndividualsTruncated: boolean;
  pendingIndividualsError: string | null;
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
  const { scope, dniZapasu, dataOd, dataDo, zapasMin } = input;
  const touchProgress = (patch: ZdOrderEngineProgressPatch) => {
    input.onProgress?.(patch);
  };

  // Pełna lista towarów zakresu z Subiekta (nie tylko braki API / nie nasza baza).
  // Echo filtra zaraz po 1. stronie — bez tego stary API mógłby dociągnąć cały katalog.
  touchProgress({ phase: "fetch" });
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
  let fetched = primaryFetched;
  for (const extra of extraScopes) {
    const extraId = scopeIdOf(extra);
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

  touchProgress({
    phase: "settings",
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
      message: `Lista nie została pokazana — bez wykluczeń mogłaby zawierać produkty celowo pomijane. ${message}`,
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
      message: `Lista nie została pokazana — bez flagi mogłyby wejść produkty zamawiane wyłącznie na prośbę. ${message}`,
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
      message: `Lista nie została pokazana — bez opakowań qty ZD mogłoby być w sztukach zamiast paczek. ${message}`,
      hint: "Odśwież stronę lub spróbuj ponownie za chwilę.",
    });
    return { ok: false, feedback };
  }
  const packaging = packagingSettled.value;

  // Min stock — soft fail (bez minimum lista działa, po prostu bez dobijania).
  const minStock = minStockSettled.ok ? minStockSettled.value : [];
  const minStockByTwId = minStockRowsToMap(minStock);

  if (!productPairsSettled.ok) {
    const message = userFacingErrorText(
      productPairsSettled.error,
      "Nie udało się wczytać mapy par montaż/demontaż."
    );
    const feedback = getSubiektFeedback("empty_query", {
      title: "Pary kompletów niedostępne",
      message: `Lista nie została pokazana — bez mapy par pack i piece mogłyby dostać niezależne qty (podwójne zamówienie). ${message}`,
      hint: "Odśwież stronę lub spróbuj ponownie za chwilę.",
    });
    return { ok: false, feedback };
  }
  const productPairs = productPairsSettled.value;

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
      message: `Lista nie została pokazana — bez katalogu zębów pozycje zębowe mogłyby trafić na ZD. ${message}`,
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

  touchProgress({ phase: "compose" });
  const result = buildManualZdEstimateResult(fetched.parametry, mergedPozycje, {
    onlyManualBraki: false,
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
    }
  }

  // Podpowiedź: ostatnie ZD na ten towar było u innego dostawcy.
  const otherSupplierHintByTwId: Record<number, string> = {};
  if (input.supplierId) {
    try {
      const last = await loadLastZdSupplierByTwIds(result.pozycje.map((p) => p.tw_Id));
      for (const [tw, hit] of last) {
        if (hit.supplierId !== input.supplierId) otherSupplierHintByTwId[tw] = hit.supplierName;
      }
    } catch {
      // Tylko podpowiedź — bez niej lista działa.
    }
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
