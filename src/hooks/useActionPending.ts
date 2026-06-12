"use client";

import { useCallback, useState, useTransition } from "react";

type RunOptions = {
  onError?: (error: unknown) => void;
};

/**
 * useTransition + komunikat ładowania do overlay (ActionLoadingOverlay).
 */
export function useActionPending() {
  const [pending, start] = useTransition();
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);

  const run = useCallback(
    (task: () => Promise<void>, message = "Przetwarzanie…", options?: RunOptions) => {
      setPendingMessage(message);
      start(async () => {
        try {
          await task();
        } catch (error) {
          options?.onError?.(error);
        } finally {
          setPendingMessage(null);
        }
      });
    },
    []
  );

  return { pending, pendingMessage, run, start };
}
