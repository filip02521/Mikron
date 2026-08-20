"use client";

import { useCallback, useEffect, useState } from "react";
import { useClientHydrated } from "@/lib/client/use-client-hydrated";
import { deleteZdEstimateExternalSessionRecord } from "@/lib/orders/zd-estimate-external-session-actions";
import {
  clearZdEstimateExternalSessionToken,
  consumeExpiredOrInvalidZdEstimateExternalSessionToken,
  getZdEstimateExternalSessionRemainingMs,
  peekZdEstimateExternalSessionToken,
  readZdEstimateExternalSessionToken,
  startAwayTimerForExternalSession,
  writeZdEstimateExternalSessionToken,
  ZD_ESTIMATE_EXTERNAL_SESSION_AWAY_WINDOW_MS,
  ZD_ESTIMATE_UI_SESSION_SNAPSHOT_SCHEMA_VERSION,
} from "@/lib/orders/zd-estimate-external-session";

export type ZdEstimateExternalSessionAwayNoticeState = {
  remainingMs: number;
  sessionId: string;
  totalMs: number;
};

/**
 * Powiadomienie poza kreatorem: countdown 3 min.
 * Gdy użytkownik opuszcza kreator z paused tokenem — tu startujemy away timer
 * (workbench odkłada start o ~120ms dla Strict Mode; notice nie może na to czekać
 * bez pollingu, bo inaczej nigdy się nie pojawi).
 */
export function useZdEstimateExternalSessionAwayNotice(input?: {
  /** Wyłącz polling (np. na stronie kreatora). */
  enabled?: boolean;
  /**
   * Gdy true (domyślnie): paused token poza kreatorem → od razu start away.
   * Harness E2E / forceEnabled powinien podać false — start away robi jawne „Wyjdź”.
   */
  startAwayIfPaused?: boolean;
}) {
  const enabled = input?.enabled ?? true;
  const startAwayIfPaused = input?.startAwayIfPaused ?? true;
  const hydrated = useClientHydrated();

  const [notice, setNotice] = useState<ZdEstimateExternalSessionAwayNoticeState | null>(
    null
  );
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (!hydrated || !enabled) {
      return;
    }

    const syncFromToken = () => {
      const expiredId = consumeExpiredOrInvalidZdEstimateExternalSessionToken();
      if (expiredId) {
        void deleteZdEstimateExternalSessionRecord(expiredId);
        setNotice(null);
        return false;
      }

      let token = peekZdEstimateExternalSessionToken();
      if (!token) {
        setNotice(null);
        return false;
      }

      if (
        token.schemaVersion !== ZD_ESTIMATE_UI_SESSION_SNAPSHOT_SCHEMA_VERSION
      ) {
        const staleId = token.sessionId;
        clearZdEstimateExternalSessionToken();
        void deleteZdEstimateExternalSessionRecord(staleId);
        setNotice(null);
        return false;
      }

      if (token.awayExpiresAtMs == null) {
        if (!startAwayIfPaused) {
          setNotice(null);
          return false;
        }
        const started = startAwayTimerForExternalSession(token);
        if (getZdEstimateExternalSessionRemainingMs(started) <= 0) {
          clearZdEstimateExternalSessionToken();
          void deleteZdEstimateExternalSessionRecord(token.sessionId);
          setNotice(null);
          return false;
        }
        writeZdEstimateExternalSessionToken(started);
        token = started;
      }

      const remainingMs = getZdEstimateExternalSessionRemainingMs(token);
      if (remainingMs <= 0) {
        clearZdEstimateExternalSessionToken();
        void deleteZdEstimateExternalSessionRecord(token.sessionId);
        setNotice(null);
        return false;
      }

      setNotice({
        remainingMs,
        sessionId: token.sessionId,
        totalMs: ZD_ESTIMATE_EXTERNAL_SESSION_AWAY_WINDOW_MS,
      });
      return true;
    };

    // Odłóż pierwszy sync poza body effectu (react-hooks/set-state-in-effect).
    const bootId = window.setTimeout(() => {
      syncFromToken();
    }, 0);

    const intervalId = window.setInterval(() => {
      syncFromToken();
    }, 500);

    return () => {
      window.clearTimeout(bootId);
      window.clearInterval(intervalId);
    };
  }, [enabled, hydrated, startAwayIfPaused]);

  const closeSession = useCallback(async () => {
    const token = readZdEstimateExternalSessionToken();
    if (!token) {
      const expiredId = consumeExpiredOrInvalidZdEstimateExternalSessionToken();
      if (expiredId) {
        await deleteZdEstimateExternalSessionRecord(expiredId);
      }
      setNotice(null);
      return;
    }
    setClosing(true);
    clearZdEstimateExternalSessionToken();
    await deleteZdEstimateExternalSessionRecord(token.sessionId);
    setClosing(false);
    setNotice(null);
  }, []);

  return {
    notice,
    closing,
    closeSession,
    // Gdy wyłączone (kreator / !hydrated) — nie pokazuj starego notice ze stanu.
    visible: Boolean(hydrated && enabled && notice),
  };
}
