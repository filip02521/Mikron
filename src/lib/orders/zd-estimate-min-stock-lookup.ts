import type { ZdEstimateMinStockRow } from "@/lib/data/zd-estimate-min-stock";

/**
 * Mapa tw_Id → minStockSzt do szybkiego lookupu w estymacji (client-safe).
 * Bez importów createAdminClient — bezpieczne do użycia w komponentach client.
 */
export function minStockRowsToMap(
  rows: readonly ZdEstimateMinStockRow[]
): Map<number, number> {
  const map = new Map<number, number>();
  for (const row of rows) {
    if (row.minStockSzt > 0) {
      map.set(row.subiektTwId, row.minStockSzt);
    }
  }
  return map;
}
