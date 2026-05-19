"use client";

import { useCallback, useState, useTransition } from "react";

/**
 * useTransition + komunikat ładowania do overlay (ActionLoadingOverlay).
 */
export function useActionPending() {
  const [pending, start] = useTransition();
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);

  const run = useCallback(
    (task: () => Promise<void>, message = "Przetwarzanie…") => {
      setPendingMessage(message);
      start(async () => {
        try {
          await task();
        } finally {
          setPendingMessage(null);
        }
      });
    },
    []
  );

  return { pending, pendingMessage, run, start };
}
