import type { ZdEstimateExclusionRow } from "@/lib/data/zd-estimate-exclusions";
import type { ZdEstimateOnRequestRow } from "@/lib/data/zd-estimate-on-request";
import type { ZdEstimatePackagingRow } from "@/lib/data/zd-estimate-packaging";
import type { ZdProductPairRow } from "@/lib/data/zd-product-pairs";
import type { ZdProductBomRow } from "@/lib/data/zd-product-boms";
import {
  normalizeZdBoostPowerPreset,
  ZD_BOOST_POWER_PRESET_IDS,
  type ZdBoostPowerPreset,
} from "@/lib/orders/zd-estimate-boost-presets";
import type { ManualZdEstimateLine } from "@/lib/orders/zd-estimate-manual";
import type {
  ZdEstimateColumnVisibility,
  ZdEstimateListFilter,
  ZdEstimateOptionalColumn,
} from "@/lib/orders/zd-estimate-prefs";
import type { ZdEstimateRunMode } from "@/lib/orders/zd-estimate-scope";
import type { ZdEstimateSalesWindowSource } from "@/lib/orders/zd-estimate-sales-window";
import type {
  ZdEstimateListSortDir,
  ZdEstimateListSortKey,
} from "@/lib/orders/zd-estimate-sort";
import type {
  ZdEstimateCechaOption,
  ZdEstimateGroupOption,
} from "@/app/actions/zd-estimate";
import type { ZdEstimatePendingIndividualOrder } from "@/lib/orders/zd-estimate-individual";
import { ZD_ESTIMATE_UI_SESSION_SNAPSHOT_SCHEMA_VERSION } from "@/lib/orders/zd-estimate-external-session";

export type ZdEstimateUiSessionHistoryEntry = {
  twId: number;
  lastOrderedQty: number;
  linkedAt: string;
};

export type ZdEstimateUiSessionSnapshotMeta = {
  pagesFetched: number;
  totalCountApi: number;
  truncated: boolean;
  ordersBaseUrl: string;
  durationMs: number;
  totalFromSubiekt: number;
};

/** Snapshot roboczy UI kreatora ZD po „Policz” (zapis w DB). */
export type ZdEstimateUiSessionSnapshot = {
  schemaVersion: number;
  createdAt: string;
  updatedAt: string;

  linesBase: ManualZdEstimateLine[];
  lines: ManualZdEstimateLine[];
  historyByTwId: ZdEstimateUiSessionHistoryEntry[];
  historyFetchFailed: boolean;

  pendingIndividuals: ZdEstimatePendingIndividualOrder[];
  pendingIndividualsTruncated: boolean;
  pendingIndividualsError: string | null;

  meta: ZdEstimateUiSessionSnapshotMeta;
  missingPartnerTwIds: number[];
  missingBomTwIds: number[];

  paramInfo: Record<string, unknown>;
  exclusions: ZdEstimateExclusionRow[];
  onRequests: ZdEstimateOnRequestRow[];
  packaging: ZdEstimatePackagingRow[];
  productPairs: ZdProductPairRow[];
  productBoms: ZdProductBomRow[];
  teethTwIds: number[];
  /** Aktualny wybór w UI (może różnić się od applied przy dirty boost). */
  boostPreset: ZdBoostPowerPreset;
  /** Moc użyta przy ostatnim Policz / remat — opcjonalne w starszych snapshotach. */
  appliedBoostPreset?: ZdBoostPowerPreset;
  boostNeedsRecount?: boolean;

  scopeMode: ZdEstimateRunMode;
  selectedGroup: ZdEstimateGroupOption | null;
  selectedCecha: ZdEstimateCechaOption | null;
  groupQuery: string;
  cechaQuery: string;
  supplierId: string | null;
  dniZapasu: string;
  dataOd: string;
  dataDo: string;
  zapasMin: string;
  showAdvanced: boolean;
  salesWindowSource: ZdEstimateSalesWindowSource;

  qtyOverrideByTwId: Record<number, number>;
  acceptedReviewTwIds: Record<number, true>;
  sessionIncludeTwIds: Record<number, true>;

  listFilter: ZdEstimateListFilter;
  listSearch: string;
  sortKey: ZdEstimateListSortKey;
  sortDir: ZdEstimateListSortDir;
  columns: ZdEstimateColumnVisibility;
  columnOrder: ZdEstimateOptionalColumn[];
};

export function historyEntriesFromMap(
  map: Map<number, { lastOrderedQty: number; linkedAt: string }>
): ZdEstimateUiSessionHistoryEntry[] {
  return [...map.entries()]
    .filter(([twId]) => twId > 0)
    .map(([twId, e]) => ({
      twId,
      lastOrderedQty: e.lastOrderedQty,
      linkedAt: e.linkedAt,
    }));
}

export function historyMapFromEntries(
  entries: ZdEstimateUiSessionHistoryEntry[] | undefined | null
): Map<number, { lastOrderedQty: number; linkedAt: string }> {
  const map = new Map<number, { lastOrderedQty: number; linkedAt: string }>();
  for (const e of entries ?? []) {
    if (e?.twId > 0) {
      map.set(e.twId, {
        lastOrderedQty: Number(e.lastOrderedQty),
        linkedAt: String(e.linkedAt),
      });
    }
  }
  return map;
}

export function buildZdEstimateUiSessionSnapshot(
  input: Omit<
    ZdEstimateUiSessionSnapshot,
    "schemaVersion" | "createdAt" | "updatedAt"
  > & {
    createdAt?: string;
    updatedAt?: string;
  }
): ZdEstimateUiSessionSnapshot {
  const now = new Date().toISOString();
  return {
    schemaVersion: ZD_ESTIMATE_UI_SESSION_SNAPSHOT_SCHEMA_VERSION,
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
    ...input,
  };
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function parseZdEstimateUiSessionSnapshot(
  payload: unknown,
  fallbackSchemaVersion?: number
): ZdEstimateUiSessionSnapshot | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Partial<ZdEstimateUiSessionSnapshot>;
  const schemaVersion =
    typeof p.schemaVersion === "number" ? p.schemaVersion : fallbackSchemaVersion;
  if (schemaVersion !== ZD_ESTIMATE_UI_SESSION_SNAPSHOT_SCHEMA_VERSION) {
    return null;
  }
  if (!Array.isArray(p.lines) || !Array.isArray(p.linesBase)) return null;
  if (p.scopeMode !== "grupa" && p.scopeMode !== "cecha") return null;
  if (!isNonEmptyString(p.dataOd) || !isNonEmptyString(p.dataDo)) return null;
  if (typeof p.dniZapasu !== "string") return null;

  const boostPreset = normalizeZdBoostPowerPreset(p.boostPreset);
  if (!ZD_BOOST_POWER_PRESET_IDS.includes(boostPreset)) return null;

  const appliedBoostPreset =
    p.appliedBoostPreset != null
      ? normalizeZdBoostPowerPreset(p.appliedBoostPreset)
      : boostPreset;
  if (!ZD_BOOST_POWER_PRESET_IDS.includes(appliedBoostPreset)) return null;

  const meta = p.meta;
  if (
    !meta ||
    typeof meta !== "object" ||
    typeof meta.pagesFetched !== "number" ||
    typeof meta.totalCountApi !== "number" ||
    typeof meta.truncated !== "boolean" ||
    !isNonEmptyString(meta.ordersBaseUrl) ||
    typeof meta.durationMs !== "number" ||
    typeof meta.totalFromSubiekt !== "number"
  ) {
    return null;
  }

  return {
    ...p,
    schemaVersion,
    createdAt: p.createdAt ?? new Date(0).toISOString(),
    updatedAt: p.updatedAt ?? new Date(0).toISOString(),
    boostPreset,
    appliedBoostPreset,
    boostNeedsRecount: Boolean(p.boostNeedsRecount),
    meta,
    historyByTwId: Array.isArray(p.historyByTwId) ? p.historyByTwId : [],
    historyFetchFailed: Boolean(p.historyFetchFailed),
    pendingIndividuals: Array.isArray(p.pendingIndividuals)
      ? p.pendingIndividuals
      : [],
    pendingIndividualsTruncated: Boolean(p.pendingIndividualsTruncated),
    pendingIndividualsError:
      p.pendingIndividualsError != null
        ? String(p.pendingIndividualsError)
        : null,
    missingPartnerTwIds: Array.isArray(p.missingPartnerTwIds)
      ? p.missingPartnerTwIds
      : [],
    missingBomTwIds: Array.isArray(p.missingBomTwIds) ? p.missingBomTwIds : [],
    exclusions: Array.isArray(p.exclusions) ? p.exclusions : [],
    onRequests: Array.isArray(p.onRequests) ? p.onRequests : [],
    packaging: Array.isArray(p.packaging) ? p.packaging : [],
    productPairs: Array.isArray(p.productPairs) ? p.productPairs : [],
    productBoms: Array.isArray(p.productBoms) ? p.productBoms : [],
    teethTwIds: Array.isArray(p.teethTwIds) ? p.teethTwIds : [],
    paramInfo:
      p.paramInfo && typeof p.paramInfo === "object"
        ? (p.paramInfo as Record<string, unknown>)
        : {},
    qtyOverrideByTwId:
      p.qtyOverrideByTwId && typeof p.qtyOverrideByTwId === "object"
        ? p.qtyOverrideByTwId
        : {},
    acceptedReviewTwIds:
      p.acceptedReviewTwIds && typeof p.acceptedReviewTwIds === "object"
        ? p.acceptedReviewTwIds
        : {},
    sessionIncludeTwIds:
      p.sessionIncludeTwIds && typeof p.sessionIncludeTwIds === "object"
        ? p.sessionIncludeTwIds
        : {},
    listFilter: p.listFilter ?? "order",
    listSearch: typeof p.listSearch === "string" ? p.listSearch : "",
    zapasMin: typeof p.zapasMin === "string" ? p.zapasMin : "0",
    showAdvanced: Boolean(p.showAdvanced),
    salesWindowSource:
      p.salesWindowSource === "manual" || p.salesWindowSource === "stock"
        ? p.salesWindowSource
        : "stock",
    groupQuery: typeof p.groupQuery === "string" ? p.groupQuery : "",
    cechaQuery: typeof p.cechaQuery === "string" ? p.cechaQuery : "",
    supplierId:
      p.supplierId != null && String(p.supplierId).trim()
        ? String(p.supplierId)
        : null,
  } as ZdEstimateUiSessionSnapshot;
}
