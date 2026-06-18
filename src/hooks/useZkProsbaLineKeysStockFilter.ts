"use client";

import { useEffect, useMemo, useState } from "react";
import { actionFetchProsbaLineStock } from "@/app/actions/subiekt";
import {
  collectZkProsbaScopeLineTwIds,
  filterZkProsbaScopeLineKeysNeedingOrder,
  zkProsbaScopeStockFetchFailed,
  type ProsbaLineStockSnapshot,
  type ZkProsbaScopeLineInput,
} from "@/lib/orders/prosba-stock-check";

type StockFetchState = {
  signature: string;
  stockByTwId: Record<number, ProsbaLineStockSnapshot>;
  loading: boolean;
};

const EMPTY_STOCK_FETCH: StockFetchState = {
  signature: "",
  stockByTwId: {},
  loading: false,
};

/**
 * Pobiera stan z Subiekta i filtruje klucze pozycji ZK — pomija te z pełnym pokryciem magazynowym.
 * Używane przy uzupełnianiu prośby z karty ZK i modala odświeżenia.
 */
export function useZkProsbaLineKeysStockFilter(
  scopeLines: ZkProsbaScopeLineInput[],
  sourceKeys: string[],
  enabled: boolean
) {
  const [fetchState, setFetchState] = useState<StockFetchState>(EMPTY_STOCK_FETCH);

  const scopeSignature = useMemo(
    () =>
      scopeLines
        .map((line) => `${line.key}:${line.subiektTwId ?? ""}:${line.quantity ?? ""}`)
        .join("|"),
    [scopeLines]
  );
  const sourceKeysSignature = sourceKeys.join(",");
  const fetchSignature = `${enabled ? "1" : "0"}:${sourceKeysSignature}:${scopeSignature}`;

  useEffect(() => {
    if (!enabled || !sourceKeys.length) {
      return;
    }

    const twIds = collectZkProsbaScopeLineTwIds(scopeLines);
    if (!twIds.length) {
      return;
    }

    let cancelled = false;

    void (async () => {
      setFetchState({ signature: fetchSignature, stockByTwId: {}, loading: true });
      try {
        const stock = await actionFetchProsbaLineStock(twIds);
        if (cancelled) return;
        setFetchState({ signature: fetchSignature, stockByTwId: stock, loading: false });
      } catch {
        if (cancelled) return;
        setFetchState({ signature: fetchSignature, stockByTwId: {}, loading: false });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, fetchSignature, scopeLines, sourceKeys.length]);

  const stockMatches = fetchState.signature === fetchSignature;
  const stockByTwId = useMemo(
    () => (stockMatches ? fetchState.stockByTwId : {}),
    [stockMatches, fetchState.stockByTwId]
  );
  const stockLoading = enabled && stockMatches && fetchState.loading;

  const lineKeysToOrder = useMemo(
    () =>
      enabled
        ? filterZkProsbaScopeLineKeysNeedingOrder(scopeLines, sourceKeys, stockByTwId)
        : [...sourceKeys],
    [enabled, scopeLines, sourceKeys, stockByTwId]
  );

  const sourceCount = sourceKeys.length;
  const excludedByStockCount = sourceCount - lineKeysToOrder.length;
  const allOnStock = enabled && !stockLoading && sourceCount > 0 && lineKeysToOrder.length === 0;
  const stockFetchFailed =
    enabled && !stockLoading && zkProsbaScopeStockFetchFailed(scopeLines, stockByTwId);

  return {
    stockByTwId,
    stockLoading,
    lineKeysToOrder,
    excludedByStockCount,
    allOnStock,
    stockFetchFailed,
  };
}
