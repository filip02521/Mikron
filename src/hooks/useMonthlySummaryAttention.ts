"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import {
  markMonthlySummarySeen,
  monthlySummaryNeedsAttention,
  readMonthlySummarySeenMonth,
  subscribeMonthlySummarySeen,
} from "@/lib/monthly-summary-attention";
import { defaultMonthlySummaryMonthKey } from "@/lib/data/monthly-stats-shared";

export function useMonthlySummaryNeedsAttention(): boolean {
  const seenMonth = useSyncExternalStore(
    subscribeMonthlySummarySeen,
    readMonthlySummarySeenMonth,
    () => null
  );
  return useMemo(() => monthlySummaryNeedsAttention(new Date(), seenMonth), [seenMonth]);
}

/** Oznacza podsumowanie jako obejrzane po wejściu na stronę. */
export function useMarkMonthlySummarySeenOnVisit(): void {
  const monthKey = useMemo(() => defaultMonthlySummaryMonthKey(), []);
  useEffect(() => {
    markMonthlySummarySeen(monthKey);
  }, [monthKey]);
}
