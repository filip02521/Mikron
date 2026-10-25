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

/**
 * Pary: minimum w sztukach pary może być ustawione na wierszu paczki albo sztuki (oba mają menu),
 * a liczy się na paczce — paczka dostaje większe z dwóch. Bez tego minimum ze sztuki znikało
 * w ścieżkach, które czytają mapę po tw paczki (np. para „na prośbę”).
 */
export function withPairMinStock(
  map: ReadonlyMap<number, number>,
  pairs: readonly { packTwId: number; pieceTwId: number }[] | null | undefined
): Map<number, number> {
  const out = new Map(map);
  for (const p of pairs ?? []) {
    const min = Math.max(map.get(p.packTwId) ?? 0, map.get(p.pieceTwId) ?? 0);
    if (min > 0) out.set(p.packTwId, min);
  }
  return out;
}
