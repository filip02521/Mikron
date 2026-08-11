import type { ManualZdEstimateLine } from "@/lib/orders/zd-estimate-manual";
import {
  individualExtraPiecesForTw,
  resolveOrderQtyForLine,
} from "@/lib/orders/zd-estimate-packaging";

export type ZdEstimateListSortKey = "symbol" | "name" | "doZd";
export type ZdEstimateListSortDir = "asc" | "desc";

export type ZdEstimateSortPackaging = {
  unitsPerPackage: number;
  packageLabel?: string;
};

function compareText(a: string, b: string): number {
  return a.localeCompare(b, "pl", { numeric: true, sensitivity: "base" });
}

/**
 * Sortuje widoczne linie szacunku (kopia tablicy).
 * „Do ZD” = jednostki dokumentu po opakowaniu (`resolveOrderQtyForLine`).
 */
export function sortZdEstimateLines(
  lines: readonly ManualZdEstimateLine[],
  sortKey: ZdEstimateListSortKey,
  sortDir: ZdEstimateListSortDir,
  packagingById?: ReadonlyMap<number, ZdEstimateSortPackaging> | null,
  individualExtraByTwId?: ReadonlyMap<number, number> | null
): ManualZdEstimateLine[] {
  const dir = sortDir === "asc" ? 1 : -1;
  const pack = packagingById ?? null;

  return [...lines].sort((a, b) => {
    let cmp = 0;
    if (sortKey === "symbol") {
      cmp = compareText(a.tw_Symbol, b.tw_Symbol);
    } else if (sortKey === "name") {
      cmp = compareText(a.tw_Nazwa, b.tw_Nazwa);
    } else {
      const qa = resolveOrderQtyForLine(
        a,
        pack?.get(a.tw_Id) ?? null,
        individualExtraPiecesForTw(a.tw_Id, individualExtraByTwId)
      ).zdUnits;
      const qb = resolveOrderQtyForLine(
        b,
        pack?.get(b.tw_Id) ?? null,
        individualExtraPiecesForTw(b.tw_Id, individualExtraByTwId)
      ).zdUnits;
      cmp = qa - qb;
    }
    if (cmp !== 0) return dir * cmp;
    return compareText(a.tw_Symbol, b.tw_Symbol);
  });
}

/** Przy zmianie kolumny: tekst A→Z, Do ZD od największej. */
export function defaultDirForZdEstimateSortKey(
  key: ZdEstimateListSortKey
): ZdEstimateListSortDir {
  return key === "doZd" ? "desc" : "asc";
}
