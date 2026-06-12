"use client";

import { useEffect, useState } from "react";
import { formatDailyPanelSyncLabel } from "@/lib/orders/daily-panel-section-anchors";

/** Odświeża etykietę czasu względnego co 30 s. */
export function useSyncRelativeTime(
  lastSyncedAt: number | null,
  lastPollAt: number | null
): string {
  const [now, setNow] = useState(0);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, []);

  if (!now) {
    return formatDailyPanelSyncLabel(lastSyncedAt, lastPollAt, lastSyncedAt ?? lastPollAt ?? 0);
  }

  return formatDailyPanelSyncLabel(lastSyncedAt, lastPollAt, now);
}
