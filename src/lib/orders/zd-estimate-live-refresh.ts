/**
 * Natychmiastowe odświeżenie BOM → pary na liście szacunku
 * (bez ponownego Subiekta), gdy partnerzy/komponenty są w `pozycjeBase`.
 */

import {
  applyBomPurchaseTargetFinalize,
  applyZdEstimateBoms,
  bomRowsToRefs,
  collectMissingZdBomTwIds,
  type ZdProductBomRef,
} from "@/lib/orders/zd-estimate-bom";
import {
  mapZdEstimateLinesSolo,
  type ManualZdEstimateLine,
} from "@/lib/orders/zd-estimate-manual";
import {
  applyZdEstimatePairs,
  type ApplyZdEstimatePairsOptions,
} from "@/lib/orders/zd-estimate-pairs";
import type { ZdProductPairRef } from "@/lib/orders/zd-product-pair-units";
import type { ZdEstimatePackagingRefreshEntry } from "@/lib/orders/zd-estimate-packaging";

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
  packagingByTwId?: ReadonlyMap<number, ZdEstimatePackagingRefreshEntry> | null;
  missingBomTwIds?: ReadonlySet<number> | null;
};

/**
 * Przelicza `pozycjeBase` → solo remap (opakowanie/track) → expand BOM → remat
 * BOM → pary → finalize purchase.
 * Solo remap jest obowiązkowy: zmiana N / trybu A↔B zmienia cover w sztukach
 * i musi wejść w computeSalesTrackedCel (inaczej Create liczy ze starym celem).
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
  const remappedBase = mapZdEstimateLinesSolo(input.linesBase, {
    dniZapasu: input.options.dniZapasu,
    dniOkresu: input.options.dniOkresu,
    salesTrack: input.options.salesTrack,
    salesTrackCuts: input.options.salesTrackCuts,
    salesTrackPolicy: input.options.salesTrackPolicy,
    historyByTwId: input.options.historyByTwId,
    packagingByTwId: input.options.packagingByTwId,
    productPairs: input.pairs,
  });

  const boms = input.boms ?? [];
  const bomRefs = bomRowsToRefs(boms);
  const missingBomTwIds = collectMissingZdBomTwIds(remappedBase, bomRefs);
  const missingBomSet =
    missingBomTwIds.length > 0
      ? new Set(missingBomTwIds)
      : input.options.missingBomTwIds ?? null;

  const afterBom =
    bomRefs.length > 0
      ? applyZdEstimateBoms(remappedBase, bomRefs, {
          dniZapasu: input.options.dniZapasu,
          dniOkresu: input.options.dniOkresu,
          zapasMin: input.options.zapasMin,
          salesTrack: input.options.salesTrack,
          salesTrackCuts: input.options.salesTrackCuts,
          salesTrackPolicy: input.options.salesTrackPolicy,
          historyByTwId: input.options.historyByTwId,
          packagingByTwId: input.options.packagingByTwId,
          productPairs: input.pairs,
          missingComponentTwIds: missingBomSet,
        })
      : remappedBase.map((l) => ({ ...l, bom: null as null, pair: null }));

  const missingPartnerTwIds = collectMissingZdPairPartnerTwIds(
    afterBom,
    input.pairs
  );
  const missingPairSet =
    missingPartnerTwIds.length > 0
      ? new Set(missingPartnerTwIds)
      : input.options.missingPartnerTwIds ?? null;

  const withPairs = applyZdEstimatePairs(afterBom, input.pairs, {
    ...input.options,
    missingPartnerTwIds: missingPairSet,
  });
  const lines = applyBomPurchaseTargetFinalize(withPairs);

  return { lines, missingPartnerTwIds, missingBomTwIds };
}

export { collectMissingZdBomTwIds };
