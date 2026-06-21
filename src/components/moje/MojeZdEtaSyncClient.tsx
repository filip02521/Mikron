"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  shouldMarkMojeZdEtaSessionDone,
  shouldRetryMojeZdEtaSync,
  type MojeZdEtaRefreshResult,
  ZD_ETA_MOJE_CLIENT_FETCH_TIMEOUT_MS,
  ZD_ETA_MOJE_VISIBILITY_RESYNC_MS,
} from "@/lib/subiekt/zd-eta-sync";

const LOCK_RETRY_MS = 5_000;
const MAX_LOCK_RETRIES = 2;
const MAX_NETWORK_RETRIES = 2;
const NETWORK_RETRY_MS = 3_000;

const MOJE_ZD_ETA_SESSION_KEY = "moje-zd-eta-client-sync-v1";

function getMojeZdEtaSessionDoneCount(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(MOJE_ZD_ETA_SESSION_KEY);
    if (!raw) return null;
    const count = Number(raw);
    return Number.isFinite(count) && count >= 0 ? count : null;
  } catch {
    return null;
  }
}

function shouldSkipMojeZdEtaSessionSync(syncEligibleCount: number): boolean {
  const doneCount = getMojeZdEtaSessionDoneCount();
  return doneCount != null && doneCount >= syncEligibleCount;
}

export function clearMojeZdEtaSessionSync(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(MOJE_ZD_ETA_SESSION_KEY);
  } catch {
    /* ignore */
  }
}

function markMojeZdEtaSessionDone(syncEligibleCount: number): void {
  try {
    sessionStorage.setItem(MOJE_ZD_ETA_SESSION_KEY, String(syncEligibleCount));
  } catch {
    /* ignore */
  }
}

/**
 * Po wejściu na /moje uruchamia sync terminów ZD (live search) dla opóźnionych pozycji
 * i odświeża widok po zakończeniu próby (sukces, brak dopasowania, timeout lub Subiekt offline).
 * Po dłuższej nieobecności na karcie ponawia sync (np. zmiana terminu przez zakupy).
 */
export function MojeZdEtaSyncClient({ syncEligibleCount }: { syncEligibleCount: number }) {
  const router = useRouter();
  const startedRef = useRef(false);
  const hiddenAtRef = useRef<number | null>(null);
  const runSyncRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (syncEligibleCount <= 0) return;

    let cancelled = false;

    const finish = (body: MojeZdEtaRefreshResult | null, networkRetry: number) => {
      if (cancelled) return;
      if (shouldRetryMojeZdEtaSync(body, networkRetry, MAX_NETWORK_RETRIES)) {
        window.setTimeout(() => {
          void run(0, networkRetry + 1);
        }, NETWORK_RETRY_MS);
        return;
      }
      if (body && shouldMarkMojeZdEtaSessionDone(body, syncEligibleCount)) {
        markMojeZdEtaSessionDone(syncEligibleCount);
      } else {
        startedRef.current = false;
      }
      router.refresh();
    };

    const run = async (lockRetry = 0, networkRetry = 0) => {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(
        () => controller.abort(),
        ZD_ETA_MOJE_CLIENT_FETCH_TIMEOUT_MS
      );

      try {
        const res = await fetch("/api/sales/zd-eta-refresh", {
          method: "POST",
          signal: controller.signal,
        });
        if (cancelled) return;

        if (!res.ok) {
          finish(null, networkRetry);
          return;
        }

        const body = (await res.json()) as MojeZdEtaRefreshResult;
        if (cancelled) return;

        if (body.skipped && body.reason === "lock_held" && lockRetry < MAX_LOCK_RETRIES) {
          window.setTimeout(() => {
            void run(lockRetry + 1, networkRetry);
          }, LOCK_RETRY_MS);
          return;
        }

        if (body.skipped && body.reason === "lock_held") {
          finish(body, networkRetry);
          return;
        }

        finish(body, networkRetry);
      } catch {
        if (!cancelled) {
          finish(null, networkRetry);
        }
      } finally {
        window.clearTimeout(timeoutId);
      }
    };

    const startSync = () => {
      if (shouldSkipMojeZdEtaSessionSync(syncEligibleCount)) return;
      if (startedRef.current) return;
      startedRef.current = true;
      void run();
    };

    runSyncRef.current = () => {
      clearMojeZdEtaSessionSync();
      startedRef.current = false;
      startSync();
    };

    startSync();

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        hiddenAtRef.current = Date.now();
        return;
      }
      if (document.visibilityState !== "visible") return;
      const hiddenAt = hiddenAtRef.current;
      hiddenAtRef.current = null;
      if (hiddenAt == null) return;
      if (Date.now() - hiddenAt < ZD_ETA_MOJE_VISIBILITY_RESYNC_MS) return;
      runSyncRef.current?.();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      runSyncRef.current = null;
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [syncEligibleCount, router]);

  return null;
}
