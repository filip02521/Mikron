"use client";

import { useMemo } from "react";
import { useProsbaLineStockBatchFetch } from "@/hooks/useProsbaLineStockBatchFetch";
import { isInformacjaRequest } from "@/lib/orders/individual";
import type { IndividualOrder } from "@/types/database";
import type { ProsbaLineStockSnapshot } from "@/lib/orders/prosba-stock-check";

/**
 * Zbiera twIds z zamówień (nie informacji) w kolejce przyjęcia
 * i batch-fetchuje stan z Subiekta.
 * Zwraca mapę twId → snapshot dla pozycji gdzie available > 0.
 */
export function useReceiveQueueStockAlert(
  orders: IndividualOrder[],
  enabled: boolean,
): {
  stockByTwId: Record<number, ProsbaLineStockSnapshot>;
  availableTwIds: Set<number>;
  availableCount: number;
  loading: boolean;
} {
  const twIds = useMemo(() => {
    const ids = new Set<number>();
    for (const order of orders) {
      if (isInformacjaRequest(order)) continue;
      if (order.is_teeth) continue;
      if (order.status !== "Zamowione") continue;
      const twId = order.subiekt_tw_id;
      if (twId != null && twId > 0) ids.add(Math.trunc(twId));
    }
    return [...ids];
  }, [orders]);

  const { stockByTwId, loading } = useProsbaLineStockBatchFetch(twIds, enabled && twIds.length > 0);

  const availableTwIds = useMemo(() => {
    const set = new Set<number>();
    for (const [twIdStr, snap] of Object.entries(stockByTwId)) {
      if (snap.available > 0) set.add(Number(twIdStr));
    }
    return set;
  }, [stockByTwId]);

  const availableCount = useMemo(() => {
    let count = 0;
    for (const order of orders) {
      if (isInformacjaRequest(order)) continue;
      if (order.is_teeth) continue;
      if (order.status !== "Zamowione") continue;
      const twId = order.subiekt_tw_id;
      if (twId != null && twId > 0 && availableTwIds.has(Math.trunc(twId))) count++;
    }
    return count;
  }, [orders, availableTwIds]);

  return {
    stockByTwId,
    availableTwIds,
    availableCount,
    loading,
  };
}
