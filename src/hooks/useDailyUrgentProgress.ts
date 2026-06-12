"use client";

import { useEffect, useRef, useState } from "react";
import { useClientHydrated } from "@/lib/client/use-client-hydrated";
import { formatDateString } from "@/lib/orders/dates";
import {
  computeDailyUrgentProgress,
  mergeUrgentBaseline,
  type DailyUrgentProgress,
} from "@/lib/orders/daily-urgent-progress";
import { todayInWarsaw } from "@/lib/time/warsaw";

const STORAGE_KEY_PREFIX = "panel-urgent-baseline-";

function storageKey(): string {
  return STORAGE_KEY_PREFIX + formatDateString(todayInWarsaw());
}

function readBaseline(): number | null {
  if (typeof sessionStorage === "undefined") return null;
  const raw = sessionStorage.getItem(storageKey());
  if (!raw) return null;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Postęp listy zaległe + na dziś (harmonogram) — logika zsynchronizowana z useDailyDayProgress. */
export function useDailyUrgentProgress(remaining: number): DailyUrgentProgress {
  const hydrated = useClientHydrated();
  const prevRemainingRef = useRef(remaining);
  const [progress, setProgress] = useState(() => computeDailyUrgentProgress(null, remaining));

  useEffect(() => {
    if (!hydrated || typeof sessionStorage === "undefined") return;

    const key = storageKey();
    const prevRemaining = prevRemainingRef.current;
    const baseline = mergeUrgentBaseline(readBaseline(), remaining, prevRemaining);
    if (baseline != null) {
      sessionStorage.setItem(key, String(baseline));
    }
    prevRemainingRef.current = remaining;
    setProgress(computeDailyUrgentProgress(baseline, remaining));
  }, [hydrated, remaining]);

  return progress;
}
