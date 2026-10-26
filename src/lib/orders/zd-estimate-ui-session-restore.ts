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
import { minStockRowsToMap, withPairMinStock } from "@/lib/orders/zd-estimate-min-stock-lookup";
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

type RecomputeResult = {
  lines: ManualZdEstimateLine[];
  missingPartnerTwIds: number[];
  missingBomTwIds: number[];
};

/**
 * Przeliczenie listy (bez Subiekta) z kompletem reguł podanym jawnie — jedno
 * przejście zamiast łańcucha `apply*Live`, z których każde widzi tylko swoją
 * świeżą regułę, a resztę z closure.
 * Niewczytane reguły traktuje jak kreator (pominięte; Policz/Utwórz ZD i tak
 * blokuje baner błędu).
 */
export function recomputeZdEstimateLinesWithRules(
  input: {
    linesBase: ManualZdEstimateLine[];
    paramInfo: Record<string, unknown> | null | undefined;
    dniZapasu: string;
    zapasMin: string;
    historyByTwId: ReadonlyMap<
      number,
      { lastOrderedQty: number; linkedAt: string }
    > | null;
    salesTrackPolicy: ReturnType<typeof policyForBoostPreset>;
    sessionIncludeTwIds: Record<number, true>;
  },
  rules: ZdEstimateRestoreRules
): RecomputeResult {
  const onRequestIds = rules.onRequestTrusted
    ? onRequestTwIdSet(rules.onRequests, rules.productPairs)
    : new Set<number>();
  const excludedTwIds = buildZdEstimateBakeExcludedTwIds({
    linesBase: input.linesBase,
    dbExcludedTwIds: rules.exclusionsTrusted
      ? rules.exclusions.map((e) => e.subiektTwId)
      : [],
    teethTwIds: rules.teethTrusted ? new Set(rules.teethTwIds) : null,
    sessionIncludeTwIds: input.sessionIncludeTwIds,
    onRequestTwIds: onRequestIds,
  });
  return refreshZdEstimateLinesWithPairs({
    linesBase: input.linesBase,
    pairs: rules.productPairs,
    boms: bomRowsToRefs(rules.productBoms),
    options: {
      ...zdEstimateRefreshDays(input.paramInfo, input.dniZapasu),
      zapasMin: Number(input.zapasMin) || 0,
      excludedTwIds,
      packagingByTwId: packagingRowsToRefreshLookup(rules.packaging),
      historyByTwId:
        input.historyByTwId && input.historyByTwId.size > 0
          ? input.historyByTwId
          : null,
      salesTrackPolicy: input.salesTrackPolicy,
      minStockByTwId: withPairMinStock(minStockRowsToMap(rules.minStock), rules.productPairs),
    },
  });
}

/**
 * Lista z przywróconej sesji przeliczona raz z bieżącymi regułami z bazy
 * (snapshot trzyma tylko `linesBase` i parametry Policz, nie kopie reguł).
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
): RecomputeResult {
  if (!snapshot.linesBase?.length) {
    return {
      lines: snapshot.lines,
      missingPartnerTwIds: snapshot.missingPartnerTwIds ?? [],
      missingBomTwIds: snapshot.missingBomTwIds ?? [],
    };
  }
  return recomputeZdEstimateLinesWithRules(
    {
      linesBase: snapshot.linesBase,
      paramInfo: snapshot.paramInfo,
      dniZapasu: snapshot.dniZapasu,
      zapasMin: snapshot.zapasMin,
      historyByTwId: historyMapFromEntries(snapshot.historyByTwId),
      salesTrackPolicy: policyForBoostPreset(
        snapshot.appliedBoostPreset ?? snapshot.boostPreset
      ),
      sessionIncludeTwIds: snapshot.sessionIncludeTwIds ?? {},
    },
    rules
  );
}
