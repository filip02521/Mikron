"use client";

import { useEffect, useState } from "react";
import { formatDailyPanelSyncLabel } from "@/lib/orders/daily-panel-section-anchors";

/** Odświeża etykietę czasu względnego co 30 s. */
export function useSyncRelativeTime(
  lastSyncedAt: number | null,
  lastPollAt: number | null
): string {
  const [, tick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => tick((n) => n + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);

  return formatDailyPanelSyncLabel(lastSyncedAt, lastPollAt);
}
