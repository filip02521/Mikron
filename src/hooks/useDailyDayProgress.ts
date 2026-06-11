"use client";

import { useMemo } from "react";
import { formatDateString } from "@/lib/orders/dates";
import {
  buildDailyDayProgress,
  type DailyDayProgress,
} from "@/lib/orders/daily-day-progress";
import { mergeUrgentBaseline } from "@/lib/orders/daily-urgent-progress";
import { todayInWarsaw } from "@/lib/time/warsaw";

const URGENT_KEY = "panel-urgent-baseline-";
const FOR_SOMEONE_KEY = "panel-for-someone-baseline-";

function storageKey(prefix: string): string {
  return prefix + formatDateString(todayInWarsaw());
}

function readBaseline(key: string): number | null {
  if (typeof sessionStorage === "undefined") return null;
  const raw = sessionStorage.getItem(key);
  if (!raw) return null;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function persistBaseline(key: string, stored: number | null, remaining: number): number | null {
  const next = mergeUrgentBaseline(stored, remaining);
  if (next != null) {
    if (next !== stored) {
      sessionStorage.setItem(key, String(next));
    }
    return next;
  }
  return null;
}

/** Postęp domykania dnia: harmonogram (zaległe + na dziś) oraz prośby handlowców. */
export function useDailyDayProgress(
  urgentRemaining: number,
  forSomeoneRemaining: number
): DailyDayProgress {
  return useMemo(() => {
    if (typeof sessionStorage === "undefined") {
      return buildDailyDayProgress(null, urgentRemaining, null, forSomeoneRemaining);
    }
    const uKey = storageKey(URGENT_KEY);
    const fKey = storageKey(FOR_SOMEONE_KEY);
    const urgentBaseline = persistBaseline(uKey, readBaseline(uKey), urgentRemaining);
    const forSomeoneBaseline = persistBaseline(
      fKey,
      readBaseline(fKey),
      forSomeoneRemaining
    );
    return buildDailyDayProgress(
      urgentBaseline,
      urgentRemaining,
      forSomeoneBaseline,
      forSomeoneRemaining
    );
  }, [urgentRemaining, forSomeoneRemaining]);
}

export type { DailyDayProgress };
