"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { actionFetchProsbaLineStock } from "@/app/actions/subiekt";
import {
  fetchProsbaStockDeduplicated,
  prosbaStockTwIdsKey,
  readProsbaStockCache,
} from "@/lib/orders/prosba-stock-fetch-cache";
import {
  PROSBA_STOCK_FETCH_UI_TIMEOUT_MS,
  type ProsbaLineStockSnapshot,
} from "@/lib/orders/prosba-stock-check";

/**
 * Batch pobrania stanu magazynowego po tw_Id z limitem czasu na UI.
 * Współdzielony cache i deduplikacja równoległych zapytań (np. wiele kart ZK).
 */
export function useProsbaLineStockBatchFetch(twIds: number[], enabled: boolean) {
  const [stockByTwId, setStockByTwId] = useState<Record<number, ProsbaLineStockSnapshot>>({});
  const [loading, setLoading] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const epochRef = useRef(0);

  const twIdsKey = useMemo(() => prosbaStockTwIdsKey(twIds), [twIds]);

  useEffect(() => {
    if (!enabled || !twIdsKey) return;

    const cached = readProsbaStockCache(twIdsKey);
    if (cached) return;

    const ids = twIdsKey.split(",").map((id) => Number(id));
    const epoch = ++epochRef.current;
    let cancelled = false;
    const isStale = () => cancelled || epochRef.current !== epoch;

    queueMicrotask(() => {
      if (isStale()) return;
      setLoading(true);
      setTimedOut(false);
      setStockByTwId({});
    });

    const timeoutId = window.setTimeout(() => {
      if (isStale()) return;
      setTimedOut(true);
      setLoading(false);
    }, PROSBA_STOCK_FETCH_UI_TIMEOUT_MS);

    void (async () => {
      try {
        const stock = await fetchProsbaStockDeduplicated(twIdsKey, ids, actionFetchProsbaLineStock);
        if (isStale()) return;
        window.clearTimeout(timeoutId);
        setStockByTwId(stock);
        setTimedOut(false);
      } catch {
        if (isStale()) return;
        window.clearTimeout(timeoutId);
        setStockByTwId({});
      } finally {
        if (!isStale()) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      setLoading(false);
    };
  }, [enabled, twIdsKey]);

  const cachedStock = useMemo(() => {
    if (!enabled || !twIdsKey) return null;
    return readProsbaStockCache(twIdsKey);
  }, [enabled, twIdsKey]);

  return {
    stockByTwId: enabled ? (cachedStock ?? stockByTwId) : {},
    loading: enabled && Boolean(twIdsKey) && !cachedStock && loading,
    timedOut: enabled && timedOut,
  };
}
