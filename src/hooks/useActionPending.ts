"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";

type RunOptions = {
  onError?: (error: unknown) => void;
};

export const SAFETY_TIMEOUT_MS = 30_000;

/**
 * useTransition + komunikat ładowania do overlay (ActionLoadingOverlay).
 */
export function useActionPending() {
  const [pending, start] = useTransition();
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const safetyTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (safetyTimerRef.current) window.clearTimeout(safetyTimerRef.current);
    };
  }, []);

  const run = useCallback(
    (task: () => Promise<void>, message = "Przetwarzanie…", options?: RunOptions) => {
      setPendingMessage(message);
      if (safetyTimerRef.current) window.clearTimeout(safetyTimerRef.current);
      safetyTimerRef.current = window.setTimeout(() => {
        setPendingMessage(null);
      }, SAFETY_TIMEOUT_MS);
      start(async () => {
        try {
          await task();
        } catch (error) {
          options?.onError?.(error);
        } finally {
          if (safetyTimerRef.current) {
            window.clearTimeout(safetyTimerRef.current);
            safetyTimerRef.current = null;
          }
          setPendingMessage(null);
        }
      });
    },
    []
  );

  return { pending, pendingMessage, run, start };
}
