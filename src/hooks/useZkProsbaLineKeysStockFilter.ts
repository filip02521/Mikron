"use client";

import { useMemo } from "react";
import { useProsbaLineStockBatchFetch } from "@/hooks/useProsbaLineStockBatchFetch";
import { useTeethExemptTwIds } from "@/components/layout/TeethExemptContext";
import {
  adjustStockMapForZkLines,
  collectZkProsbaScopeLineTwIds,
  filterZkProsbaScopeLineKeysNeedingOrder,
  zkProsbaScopeStockFetchFailed,
  type ZkProsbaScopeLineInput,
} from "@/lib/orders/prosba-stock-check";

/**
 * Pobiera stan z Subiekta i filtruje klucze pozycji ZK — pomija te z pełnym pokryciem magazynowym.
 * Używane przy uzupełnianiu prośby z karty ZK i modala odświeżenia.
 */
export function useZkProsbaLineKeysStockFilter(
  scopeLines: ZkProsbaScopeLineInput[],
  sourceKeys: string[],
  enabled: boolean,
  options?: {
    /** Gdy podane — tylko zaznaczone klucze trafiają do prośby (tryb opt-in). */
    orderMarkedKeys?: string[] | null;
  }
) {
  const teethExemptTwIds = useTeethExemptTwIds();
  const twIds = useMemo(() => collectZkProsbaScopeLineTwIds(scopeLines), [scopeLines]);
  const fetchEnabled = enabled && sourceKeys.length > 0 && twIds.length > 0;
  const { stockByTwId: rawStockByTwId, loading: stockLoading, timedOut: stockFetchTimedOut } =
    useProsbaLineStockBatchFetch(twIds, fetchEnabled);

  const stockByTwId = useMemo(
    () => adjustStockMapForZkLines(scopeLines, rawStockByTwId),
    [scopeLines, rawStockByTwId]
  );

  const orderMarkedKeys = options?.orderMarkedKeys;

  const lineKeysToOrder = useMemo(() => {
    if (!enabled) return [...sourceKeys];
    if (orderMarkedKeys != null) {
      const marked = new Set(orderMarkedKeys);
      return sourceKeys.filter((key) => marked.has(key));
    }
    return filterZkProsbaScopeLineKeysNeedingOrder(
      scopeLines,
      sourceKeys,
      stockByTwId,
      teethExemptTwIds
    );
  }, [enabled, orderMarkedKeys, scopeLines, sourceKeys, stockByTwId, teethExemptTwIds]);

  const sourceCount = sourceKeys.length;
  const unmarkedCount = sourceCount - lineKeysToOrder.length;
  const allOnStock =
    enabled &&
    !stockLoading &&
    sourceCount > 0 &&
    (options?.orderMarkedKeys != null
      ? filterZkProsbaScopeLineKeysNeedingOrder(
          scopeLines,
          sourceKeys,
          stockByTwId,
          teethExemptTwIds
        ).length === 0
      : lineKeysToOrder.length === 0);
  const stockFetchFailed =
    enabled &&
    !stockLoading &&
    (stockFetchTimedOut || zkProsbaScopeStockFetchFailed(scopeLines, rawStockByTwId));

  return {
    stockByTwId,
    rawStockByTwId,
    stockLoading,
    stockFetchTimedOut,
    lineKeysToOrder,
    /** @deprecated Użyj {@link unmarkedCount} w trybie opt-in. */
    excludedByStockCount: unmarkedCount,
    unmarkedCount,
    allOnStock,
    stockFetchFailed,
  };
}
