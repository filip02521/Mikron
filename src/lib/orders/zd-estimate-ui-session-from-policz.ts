/**
 * Snapshot sesji UI kreatora ZD budowany po stronie serwera zaraz po Policz.
 * Unika drugiego, ciężkiego Server Action z przeglądarki (duże cechy, np. Ivoclar ~1590 SKU).
 */

import type { ZdEstimateExclusionRow } from "@/lib/data/zd-estimate-exclusions";
import type { ZdEstimateOnRequestRow } from "@/lib/data/zd-estimate-on-request";
import type { ZdEstimatePackagingRow } from "@/lib/data/zd-estimate-packaging";
import type { ZdProductBomRow } from "@/lib/data/zd-product-boms";
import type { ZdProductPairRow } from "@/lib/data/zd-product-pairs";
import type { ZdBoostPowerPreset } from "@/lib/orders/zd-estimate-boost-presets";
import type { ZdEstimatePendingIndividualOrder } from "@/lib/orders/zd-estimate-individual";
import { coerceZdEstimateLinesBase } from "@/lib/orders/zd-estimate-lines-base";
import type { ManualZdEstimateResult } from "@/lib/orders/zd-estimate-manual";
import {
  ZD_ESTIMATE_COLUMN_ORDER_DEFAULTS,
  ZD_ESTIMATE_COLUMN_VISIBILITY_DEFAULTS,
  type ZdEstimateColumnVisibility,
  type ZdEstimateOptionalColumn,
} from "@/lib/orders/zd-estimate-prefs";
import type { ZdEstimateRunMode } from "@/lib/orders/zd-estimate-scope";
import type { ZdEstimateSalesWindowSource } from "@/lib/orders/zd-estimate-sales-window";
import {
  defaultDirForZdEstimateSortKey,
  type ZdEstimateListSortDir,
  type ZdEstimateListSortKey,
} from "@/lib/orders/zd-estimate-sort";
import {
  buildZdEstimateUiSessionSnapshot,
  type ZdEstimateUiSessionSnapshot,
  type ZdEstimateUiSessionSnapshotMeta,
} from "@/lib/orders/zd-estimate-ui-session-snapshot";

/** Minimalne pola zakresu potrzebne w snapshotcie (bez zależności od actions). */
type ScopeGroupSeed = {
  grt_Id: number;
  grt_Nazwa: string;
  supplierId: string | null;
  supplierName: string | null;
  dniZapasu: number | null;
  stockLabel: string | null;
  subiektKhId: number | null;
  additionalSubiektKhIds: number[];
  supplierMatchSource?: "mapping" | "name" | null;
  supplierMappingUnresolved?: boolean;
};

type ScopeCechaSeed = {
  ctw_Id: number;
  ctw_Nazwa: string;
  supplierId: string | null;
  supplierName: string | null;
  dniZapasu: number | null;
  stockLabel: string | null;
  subiektKhId: number | null;
  additionalSubiektKhIds: number[];
  supplierMatchSource?: "mapping" | "name" | null;
  supplierMappingUnresolved?: boolean;
};

type HistoryEntrySeed = {
  twId: number;
  lastOrderedQty: number;
  linkedAt: string;
};

/** Lekki seed UI z workbencha — bez linii (te są już w wyniku Policz). */
export type ZdEstimateUiSessionPoliczSeed = {
  selectedGroup?: ScopeGroupSeed | null;
  selectedCecha?: ScopeCechaSeed | null;
  groupQuery?: string;
  cechaQuery?: string;
  showAdvanced?: boolean;
  salesWindowSource?: ZdEstimateSalesWindowSource;
  sortKey?: ZdEstimateListSortKey;
  sortDir?: ZdEstimateListSortDir;
  columns?: ZdEstimateColumnVisibility;
  columnOrder?: ZdEstimateOptionalColumn[];
};

export function buildZdEstimateUiSessionSnapshotFromPolicz(input: {
  mode: ZdEstimateRunMode;
  grupaId: number | null;
  cechaId: number | null;
  scopeLabel: string | null;
  supplierId: string | null;
  dniZapasu: number;
  dataOd: string;
  dataDo: string;
  zapasMin: number;
  result: ManualZdEstimateResult;
  historyByTwId: HistoryEntrySeed[];
  historyFetchFailed: boolean;
  pendingIndividuals: ZdEstimatePendingIndividualOrder[] | null;
  pendingIndividualsTruncated: boolean;
  pendingIndividualsError: string | null;
  meta: ZdEstimateUiSessionSnapshotMeta & {
    pairMissingTwIds?: number[];
    bomMissingTwIds?: number[];
  };
  exclusions: ZdEstimateExclusionRow[];
  onRequests: ZdEstimateOnRequestRow[];
  packaging: ZdEstimatePackagingRow[];
  productPairs: ZdProductPairRow[];
  productBoms: ZdProductBomRow[];
  teethTwIds: number[];
  boostPreset: ZdBoostPowerPreset;
  seed?: ZdEstimateUiSessionPoliczSeed | null;
}): ZdEstimateUiSessionSnapshot {
  const seed = input.seed ?? {};
  const label = (input.scopeLabel ?? "").trim();
  const sortKey: ZdEstimateListSortKey = seed.sortKey ?? "doZd";
  const sortDir: ZdEstimateListSortDir =
    seed.sortDir ?? defaultDirForZdEstimateSortKey(sortKey);

  const selectedGroup: ScopeGroupSeed | null =
    input.mode === "grupa"
      ? (seed.selectedGroup ??
        (input.grupaId != null && input.grupaId > 0
          ? {
              grt_Id: input.grupaId,
              grt_Nazwa: label || `Grupa ${input.grupaId}`,
              supplierId: input.supplierId,
              supplierName: null,
              dniZapasu: input.dniZapasu,
              stockLabel: null,
              subiektKhId: null,
              additionalSubiektKhIds: [],
              supplierMatchSource: null,
              supplierMappingUnresolved: false,
            }
          : null))
      : null;

  const selectedCecha: ScopeCechaSeed | null =
    input.mode === "cecha"
      ? (seed.selectedCecha ??
        (input.cechaId != null && input.cechaId > 0
          ? {
              ctw_Id: input.cechaId,
              ctw_Nazwa: label || `Cecha ${input.cechaId}`,
              supplierId: input.supplierId,
              supplierName: null,
              dniZapasu: input.dniZapasu,
              stockLabel: null,
              subiektKhId: null,
              additionalSubiektKhIds: [],
              supplierMatchSource: null,
              supplierMappingUnresolved: false,
            }
          : null))
      : null;

  const pendingOk = input.pendingIndividuals != null;
  const linesBase = coerceZdEstimateLinesBase(
    input.result.pozycjeBase ?? input.result.pozycje
  );

  return buildZdEstimateUiSessionSnapshot({
    linesBase,
    lines: input.result.pozycje,
    historyByTwId: (input.historyByTwId ?? [])
      .filter((e) => e.twId > 0)
      .map((e) => ({
        twId: e.twId,
        lastOrderedQty: e.lastOrderedQty,
        linkedAt: e.linkedAt,
      })),
    historyFetchFailed: Boolean(input.historyFetchFailed),
    pendingIndividuals: pendingOk ? (input.pendingIndividuals ?? []) : [],
    pendingIndividualsTruncated: pendingOk
      ? Boolean(input.pendingIndividualsTruncated)
      : false,
    pendingIndividualsError: pendingOk
      ? null
      : input.pendingIndividualsError?.trim() ||
        "Nie wczytano próśb przy Policz — użyj „Wczytaj ponownie” albo policz listę jeszcze raz.",
    meta: {
      pagesFetched: input.meta.pagesFetched,
      totalCountApi: input.meta.totalCountApi,
      truncated: input.meta.truncated,
      ordersBaseUrl: input.meta.ordersBaseUrl,
      durationMs: input.meta.durationMs,
      totalFromSubiekt: input.meta.totalFromSubiekt,
    },
    missingPartnerTwIds: input.meta.pairMissingTwIds ?? [],
    missingBomTwIds: input.meta.bomMissingTwIds ?? [],
    paramInfo: input.result.parametry as Record<string, unknown>,
    exclusions: input.exclusions,
    onRequests: input.onRequests,
    packaging: input.packaging,
    productPairs: input.productPairs,
    productBoms: input.productBoms,
    teethTwIds: input.teethTwIds,
    boostPreset: input.boostPreset,
    appliedBoostPreset: input.boostPreset,
    boostNeedsRecount: false,
    scopeMode: input.mode,
    selectedGroup,
    selectedCecha,
    groupQuery:
      seed.groupQuery ??
      (input.mode === "grupa" ? selectedGroup?.grt_Nazwa ?? label : ""),
    cechaQuery:
      seed.cechaQuery ??
      (input.mode === "cecha" ? selectedCecha?.ctw_Nazwa ?? label : ""),
    supplierId: input.supplierId,
    dniZapasu: String(input.dniZapasu),
    dataOd: input.dataOd,
    dataDo: input.dataDo,
    zapasMin: String(input.zapasMin > 0 ? input.zapasMin : 0),
    showAdvanced: Boolean(seed.showAdvanced),
    salesWindowSource: seed.salesWindowSource ?? "stock",
    qtyOverrideByTwId: {},
    acceptedReviewTwIds: {},
    sessionIncludeTwIds: {},
    listFilter: "order",
    listSearch: "",
    sortKey,
    sortDir,
    columns: seed.columns
      ? { ...ZD_ESTIMATE_COLUMN_VISIBILITY_DEFAULTS, ...seed.columns }
      : { ...ZD_ESTIMATE_COLUMN_VISIBILITY_DEFAULTS },
    columnOrder: seed.columnOrder?.length
      ? [...seed.columnOrder]
      : [...ZD_ESTIMATE_COLUMN_ORDER_DEFAULTS],
  });
}
