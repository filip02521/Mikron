"use client";

import { useEffect, useState } from "react";
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
  const [urgentBaseline, setUrgentBaseline] = useState<number | null>(null);
  const [forSomeoneBaseline, setForSomeoneBaseline] = useState<number | null>(null);

  useEffect(() => {
    const uKey = storageKey(URGENT_KEY);
    const fKey = storageKey(FOR_SOMEONE_KEY);
    setUrgentBaseline(persistBaseline(uKey, readBaseline(uKey), urgentRemaining));
    setForSomeoneBaseline(
      persistBaseline(fKey, readBaseline(fKey), forSomeoneRemaining)
    );
  }, [urgentRemaining, forSomeoneRemaining]);

  return buildDailyDayProgress(
    urgentBaseline,
    urgentRemaining,
    forSomeoneBaseline,
    forSomeoneRemaining
  );
}

export type { DailyDayProgress };
