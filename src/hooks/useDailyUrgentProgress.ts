"use client";

import { useEffect, useState } from "react";
import { formatDateString } from "@/lib/orders/dates";
import {
  computeDailyUrgentProgress,
  mergeUrgentBaseline,
  type DailyUrgentProgress,
} from "@/lib/orders/daily-urgent-progress";
import { todayInWarsaw } from "@/lib/time/warsaw";

export type { DailyUrgentProgress };

const STORAGE_PREFIX = "panel-urgent-baseline-";

function storageKeyForToday(): string {
  return STORAGE_PREFIX + formatDateString(todayInWarsaw());
}

function readBaseline(key: string): number | null {
  if (typeof sessionStorage === "undefined") return null;
  const raw = sessionStorage.getItem(key);
  if (!raw) return null;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Śledzi postęp domykania harmonogramu (zaległe + na dziś).
 * `remaining` powinno być z pełnej listy (bez filtra urlopów) — jak metryki Zaległe/Na dziś.
 */
export function useDailyUrgentProgress(remaining: number): DailyUrgentProgress {
  const [baseline, setBaseline] = useState<number | null>(null);

  useEffect(() => {
    const key = storageKeyForToday();
    const stored = readBaseline(key);
    const next = mergeUrgentBaseline(stored, remaining);

    if (next != null) {
      if (next !== stored) {
        sessionStorage.setItem(key, String(next));
      }
      setBaseline(next);
      return;
    }

    setBaseline(null);
  }, [remaining]);

  return computeDailyUrgentProgress(baseline, remaining);
}
