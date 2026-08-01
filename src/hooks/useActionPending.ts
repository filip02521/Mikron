"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  ACTION_PENDING_SAFETY_MS,
} from "@/lib/timing";

type RunOptions = {
  onError?: (error: unknown) => void;
  /** Domyślnie {@link ACTION_PENDING_SAFETY_MS}; dłuższe syncy: ACTION_PENDING_SAFETY_LONG_MS. */
  safetyTimeoutMs?: number;
};

/** @deprecated Użyj {@link ACTION_PENDING_SAFETY_MS} z `@/lib/timing`. */
export const SAFETY_TIMEOUT_MS = ACTION_PENDING_SAFETY_MS;

/**
 * useTransition + komunikat ładowania do overlay (ActionLoadingOverlay).
 * Safety timer tylko chowa overlay — nie anuluje zadania na serwerze.
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
      const safetyMs = options?.safetyTimeoutMs ?? ACTION_PENDING_SAFETY_MS;
      setPendingMessage(message);
      if (safetyTimerRef.current) window.clearTimeout(safetyTimerRef.current);
      safetyTimerRef.current = window.setTimeout(() => {
        setPendingMessage(null);
      }, safetyMs);
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
