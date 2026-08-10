/**
 * Natychmiastowe odświeżenie BOM → pary na liście szacunku
 * (bez ponownego Subiekta), gdy partnerzy/komponenty są w `pozycjeBase`.
 */

import {
  applyZdEstimateBoms,
  bomRowsToRefs,
  collectMissingZdBomTwIds,
  type ZdProductBomRef,
} from "@/lib/orders/zd-estimate-bom";
import type { ManualZdEstimateLine } from "@/lib/orders/zd-estimate-manual";
import {
  applyZdEstimatePairs,
  type ApplyZdEstimatePairsOptions,
} from "@/lib/orders/zd-estimate-pairs";
import type { ZdProductPairRef } from "@/lib/orders/zd-product-pair-units";

export function collectMissingZdPairPartnerTwIds(
  lines: readonly { tw_Id: number }[],
  pairs: readonly ZdProductPairRef[]
): number[] {
  const present = new Set(
    lines.map((l) => Math.trunc(Number(l.tw_Id)) || 0).filter((id) => id > 0)
  );
  const missing: number[] = [];
  const seen = new Set<number>();
  for (const pair of pairs) {
    const pack = Math.trunc(Number(pair.packTwId)) || 0;
    const piece = Math.trunc(Number(pair.pieceTwId)) || 0;
    if (!(pack > 0 && piece > 0)) continue;
    const hasPack = present.has(pack);
    const hasPiece = present.has(piece);
    if (hasPack === hasPiece) continue;
    const need = hasPack ? piece : pack;
    if (seen.has(need)) continue;
    seen.add(need);
    missing.push(need);
  }
  return missing;
}

export type RefreshZdEstimateLinesOptions = ApplyZdEstimatePairsOptions & {
  packagingByTwId?: ReadonlyMap<number, { unitsPerPackage: number }> | null;
  missingBomTwIds?: ReadonlySet<number> | null;
};

/**
 * Przelicza `pozycjeBase` → expand BOM → remat solo → pary.
 * Zwraca brakujących partnerów i węzłów BOM (wymaga pełnego Policz / fetch).
 */
export function refreshZdEstimateLinesWithPairs(input: {
  linesBase: ManualZdEstimateLine[];
  pairs: readonly ZdProductPairRef[];
  boms?: readonly ZdProductBomRef[] | null;
  options: RefreshZdEstimateLinesOptions;
}): {
  lines: ManualZdEstimateLine[];
  missingPartnerTwIds: number[];
  missingBomTwIds: number[];
} {
  const boms = input.boms ?? [];
  const missingBomTwIds = collectMissingZdBomTwIds(input.linesBase, boms);
  const missingBomSet =
    missingBomTwIds.length > 0
      ? new Set(missingBomTwIds)
      : input.options.missingBomTwIds ?? null;

  const afterBom =
    boms.length > 0
      ? applyZdEstimateBoms(input.linesBase, bomRowsToRefs(boms), {
          dniZapasu: input.options.dniZapasu,
          dniOkresu: input.options.dniOkresu,
          zapasMin: input.options.zapasMin,
          salesTrack: input.options.salesTrack,
          salesTrackCuts: input.options.salesTrackCuts,
          historyByTwId: input.options.historyByTwId,
          packagingByTwId: input.options.packagingByTwId,
          productPairs: input.pairs,
          missingComponentTwIds: missingBomSet,
        })
      : input.linesBase.map((l) => ({ ...l, bom: null as null, pair: null }));

  const missingPartnerTwIds = collectMissingZdPairPartnerTwIds(
    afterBom,
    input.pairs
  );
  const missingPairSet =
    missingPartnerTwIds.length > 0
      ? new Set(missingPartnerTwIds)
      : input.options.missingPartnerTwIds ?? null;

  const lines = applyZdEstimatePairs(afterBom, input.pairs, {
    ...input.options,
    missingPartnerTwIds: missingPairSet,
  });

  return { lines, missingPartnerTwIds, missingBomTwIds };
}

export { collectMissingZdBomTwIds };
