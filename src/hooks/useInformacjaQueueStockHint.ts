"use client";

import { useMemo } from "react";
import { useProsbaLineStockBatchFetch } from "@/hooks/useProsbaLineStockBatchFetch";
import { isInformacjaStockAutoArriveEligible } from "@/lib/orders/informacja-stock-auto-arrive";
import type { IndividualOrder } from "@/types/database";
import type { ProsbaLineStockSnapshot } from "@/lib/orders/prosba-stock-check";

/**
 * Stan Subiekta dla informacji w kolejce przyjęcia (hint UI — nie zastępuje crona).
 * Zwraca twIds gdzie available > 0.
 */
export function useInformacjaQueueStockHint(
  orders: IndividualOrder[],
  enabled: boolean
): {
  stockByTwId: Record<number, ProsbaLineStockSnapshot>;
  availableTwIds: Set<number>;
  loading: boolean;
} {
  const twIds = useMemo(() => {
    const ids = new Set<number>();
    for (const order of orders) {
      if (!isInformacjaStockAutoArriveEligible(order)) continue;
      const twId = order.subiekt_tw_id;
      if (twId != null && twId > 0) ids.add(Math.trunc(twId));
    }
    return [...ids];
  }, [orders]);

  const { stockByTwId, loading } = useProsbaLineStockBatchFetch(
    twIds,
    enabled && twIds.length > 0
  );

  const availableTwIds = useMemo(() => {
    const set = new Set<number>();
    for (const [twIdStr, snap] of Object.entries(stockByTwId)) {
      if (snap.available > 0) set.add(Number(twIdStr));
    }
    return set;
  }, [stockByTwId]);

  return { stockByTwId, availableTwIds, loading };
}
