import type { ZdEstimateExclusionRow } from "@/lib/data/zd-estimate-exclusions";
import type { ZdEstimateOnRequestRow } from "@/lib/data/zd-estimate-on-request";
import type { ZdEstimatePackagingRow } from "@/lib/data/zd-estimate-packaging";
import type { ZdEstimateMinStockRow } from "@/lib/data/zd-estimate-min-stock";
import type { ZdProductPairRow } from "@/lib/data/zd-product-pairs";
import type { ZdProductBomRow } from "@/lib/data/zd-product-boms";
import { bomRowsToRefs } from "@/lib/orders/zd-estimate-bom";
import { policyForBoostPreset } from "@/lib/orders/zd-estimate-boost-presets";
import {
  buildZdEstimateBakeExcludedTwIds,
  refreshZdEstimateLinesWithPairs,
  zdEstimateRefreshDays,
} from "@/lib/orders/zd-estimate-live-refresh";
import type { ManualZdEstimateLine } from "@/lib/orders/zd-estimate-manual";
import { minStockRowsToMap } from "@/lib/orders/zd-estimate-min-stock-lookup";
import { onRequestTwIdSet } from "@/lib/orders/zd-estimate-on-request";
import { packagingRowsToRefreshLookup } from "@/lib/orders/zd-estimate-packaging";
import {
  historyMapFromEntries,
  type ZdEstimateUiSessionSnapshot,
} from "@/lib/orders/zd-estimate-ui-session-snapshot";

/** Bieżące reguły działu (z bootstrapu strony) + czy dało się je wczytać. */
export type ZdEstimateRestoreRules = {
  exclusions: readonly ZdEstimateExclusionRow[];
  exclusionsTrusted: boolean;
  onRequests: readonly ZdEstimateOnRequestRow[];
  onRequestTrusted: boolean;
  packaging: readonly ZdEstimatePackagingRow[];
  minStock: readonly ZdEstimateMinStockRow[];
  productPairs: readonly ZdProductPairRow[];
  productBoms: readonly ZdProductBomRow[];
  teethTwIds: readonly number[];
  teethTrusted: boolean;
};

/**
 * Lista z przywróconej sesji przeliczona raz z bieżącymi regułami z bazy
 * (snapshot trzyma tylko `linesBase` i parametry Policz, nie kopie reguł).
 * Ta sama ścieżka co przeliczenie po zmianie reguły w oknie ustawień.
 * Niewczytane reguły traktuje jak kreator (pominięte; Policz/Utwórz ZD i tak
 * blokuje baner błędu).
 */
export function recomputeRestoredZdEstimateLines(
  snapshot: Pick<
    ZdEstimateUiSessionSnapshot,
    | "linesBase"
    | "lines"
    | "missingPartnerTwIds"
    | "missingBomTwIds"
    | "paramInfo"
    | "dniZapasu"
    | "zapasMin"
    | "historyByTwId"
    | "boostPreset"
    | "appliedBoostPreset"
    | "sessionIncludeTwIds"
  >,
  rules: ZdEstimateRestoreRules
): {
  lines: ManualZdEstimateLine[];
  missingPartnerTwIds: number[];
  missingBomTwIds: number[];
} {
  if (!snapshot.linesBase?.length) {
    return {
      lines: snapshot.lines,
      missingPartnerTwIds: snapshot.missingPartnerTwIds ?? [],
      missingBomTwIds: snapshot.missingBomTwIds ?? [],
    };
  }
  const onRequestIds = rules.onRequestTrusted
    ? onRequestTwIdSet(rules.onRequests, rules.productPairs)
    : new Set<number>();
  const excludedTwIds = buildZdEstimateBakeExcludedTwIds({
    linesBase: snapshot.linesBase,
    dbExcludedTwIds: rules.exclusionsTrusted
      ? rules.exclusions.map((e) => e.subiektTwId)
      : [],
    teethTwIds: rules.teethTrusted ? new Set(rules.teethTwIds) : null,
    sessionIncludeTwIds: snapshot.sessionIncludeTwIds ?? {},
    onRequestTwIds: onRequestIds,
  });
  const history = historyMapFromEntries(snapshot.historyByTwId);
  return refreshZdEstimateLinesWithPairs({
    linesBase: snapshot.linesBase,
    pairs: rules.productPairs,
    boms: bomRowsToRefs(rules.productBoms),
    options: {
      ...zdEstimateRefreshDays(snapshot.paramInfo, snapshot.dniZapasu),
      zapasMin: Number(snapshot.zapasMin) || 0,
      excludedTwIds,
      packagingByTwId: packagingRowsToRefreshLookup(rules.packaging),
      historyByTwId: history.size > 0 ? history : null,
      salesTrackPolicy: policyForBoostPreset(
        snapshot.appliedBoostPreset ?? snapshot.boostPreset
      ),
      minStockByTwId: minStockRowsToMap(rules.minStock),
    },
  });
}
