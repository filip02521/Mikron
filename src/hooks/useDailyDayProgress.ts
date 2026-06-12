"use client";

import { useEffect, useRef, useState } from "react";
import { useClientHydrated } from "@/lib/client/use-client-hydrated";
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

function writeBaseline(key: string, value: number | null): void {
  if (typeof sessionStorage === "undefined" || value == null) return;
  sessionStorage.setItem(key, String(value));
}

export type DailyDayProgressState = {
  progress: DailyDayProgress;
  /** false do pierwszego odczytu sessionStorage — ukryj pasek, żeby uniknąć skoku %. */
  ready: boolean;
};

/** Postęp domykania dnia: harmonogram (zaległe + na dziś) oraz prośby handlowców. */
export function useDailyDayProgress(
  urgentRemaining: number,
  forSomeoneRemaining: number
): DailyDayProgressState {
  const hydrated = useClientHydrated();
  const prevUrgentRef = useRef(urgentRemaining);
  const prevForSomeoneRef = useRef(forSomeoneRemaining);
  const [state, setState] = useState<DailyDayProgressState>(() => ({
    progress: buildDailyDayProgress(null, urgentRemaining, null, forSomeoneRemaining),
    ready: false,
  }));

  useEffect(() => {
    if (!hydrated || typeof sessionStorage === "undefined") return;

    const uKey = storageKey(URGENT_KEY);
    const fKey = storageKey(FOR_SOMEONE_KEY);
    const prevUrgent = prevUrgentRef.current;
    const prevForSomeone = prevForSomeoneRef.current;

    const urgentBaseline = mergeUrgentBaseline(
      readBaseline(uKey),
      urgentRemaining,
      prevUrgent
    );
    const forSomeoneBaseline = mergeUrgentBaseline(
      readBaseline(fKey),
      forSomeoneRemaining,
      prevForSomeone
    );

    if (urgentBaseline != null) writeBaseline(uKey, urgentBaseline);
    if (forSomeoneBaseline != null) writeBaseline(fKey, forSomeoneBaseline);

    prevUrgentRef.current = urgentRemaining;
    prevForSomeoneRef.current = forSomeoneRemaining;

    setState({
      progress: buildDailyDayProgress(
        urgentBaseline,
        urgentRemaining,
        forSomeoneBaseline,
        forSomeoneRemaining
      ),
      ready: true,
    });
  }, [hydrated, urgentRemaining, forSomeoneRemaining]);

  if (!hydrated) {
    return state;
  }

  return state;
}

export type { DailyDayProgress };
