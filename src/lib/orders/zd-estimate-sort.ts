import type { ManualZdEstimateLine } from "@/lib/orders/zd-estimate-manual";
import {
  effectiveZdDocumentUnits,
  individualExtraPiecesForTw,
} from "@/lib/orders/zd-estimate-packaging";

export type ZdEstimateListSortKey =
  | "symbol"
  | "name"
  | "doZd"
  | "confidence";
export type ZdEstimateListSortDir = "asc" | "desc";

export type ZdEstimateSortPackaging = {
  unitsPerPackage: number;
  packageLabel?: string;
  documentUnitMode?: import("@/lib/orders/zd-estimate-units").ZdPackagingDocumentUnitMode | null;
};

function compareText(a: string, b: string): number {
  return a.localeCompare(b, "pl", { numeric: true, sensitivity: "base" });
}

/**
 * Sortuje widoczne linie szacunku (kopia tablicy).
 * „Do ZD” = jednostki dokumentu (z nadpisaniem sesji jeśli podane).
 */
export function sortZdEstimateLines(
  lines: readonly ManualZdEstimateLine[],
  sortKey: ZdEstimateListSortKey,
  sortDir: ZdEstimateListSortDir,
  packagingById?: ReadonlyMap<number, ZdEstimateSortPackaging> | null,
  individualExtraByTwId?: ReadonlyMap<number, number> | null,
  qtyOverrideByTwId?: ReadonlyMap<number, number> | null,
  extraOnlyTwIds?: ReadonlySet<number> | null,
  extrasPolicy?: import("@/lib/orders/zd-estimate-extras-policy").ZdEstimateExtrasPolicy,
  stockNeedReliefByTwId?: ReadonlyMap<number, number> | null,
  extraOverlapByTwId?: ReadonlyMap<number, number> | null
): ManualZdEstimateLine[] {
  const dir = sortDir === "asc" ? 1 : -1;
  const pack = packagingById ?? null;

  return [...lines].sort((a, b) => {
    let cmp = 0;
    if (sortKey === "symbol") {
      cmp = compareText(a.tw_Symbol, b.tw_Symbol);
    } else if (sortKey === "name") {
      cmp = compareText(a.tw_Nazwa, b.tw_Nazwa);
    } else if (sortKey === "confidence") {
      cmp =
        (Number(a.salesTrackConfidence) || 0) -
        (Number(b.salesTrackConfidence) || 0);
    } else {
      const qa = effectiveZdDocumentUnits(
        a,
        pack?.get(a.tw_Id) ?? null,
        individualExtraPiecesForTw(a.tw_Id, individualExtraByTwId),
        qtyOverrideByTwId?.get(a.tw_Id),
        extraOnlyTwIds?.has(a.tw_Id) === true,
        extrasPolicy,
        individualExtraPiecesForTw(a.tw_Id, stockNeedReliefByTwId),
        individualExtraPiecesForTw(a.tw_Id, extraOverlapByTwId)
      );
      const qb = effectiveZdDocumentUnits(
        b,
        pack?.get(b.tw_Id) ?? null,
        individualExtraPiecesForTw(b.tw_Id, individualExtraByTwId),
        qtyOverrideByTwId?.get(b.tw_Id),
        extraOnlyTwIds?.has(b.tw_Id) === true,
        extrasPolicy,
        individualExtraPiecesForTw(b.tw_Id, stockNeedReliefByTwId),
        individualExtraPiecesForTw(b.tw_Id, extraOverlapByTwId)
      );
      cmp = qa - qb;
    }
    if (cmp !== 0) return dir * cmp;
    return compareText(a.tw_Symbol, b.tw_Symbol);
  });
}

/** Przy zmianie kolumny: tekst A→Z, Do ZD / pewność od największej. */
export function defaultDirForZdEstimateSortKey(
  key: ZdEstimateListSortKey
): ZdEstimateListSortDir {
  return key === "doZd" || key === "confidence" ? "desc" : "asc";
}
