"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { actionUndoDailyPanelChange } from "@/app/actions/admin";
import type { DailyPanelActionResult } from "@/lib/orders/daily-panel-undo";
import type { DailyPanelUndoPayload } from "@/lib/orders/daily-panel-undo";

export type DailyPanelRunFn = (
  action: () => Promise<DailyPanelActionResult>,
  successMessage: string,
  pendingMessage?: string
) => void;

type UndoState = {
  message: string;
  detailLines?: string[];
  payload: DailyPanelUndoPayload;
};

export function useDailyPanelRunner() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [undo, setUndo] = useState<UndoState | null>(null);
  const [flash, setFlash] = useState<{ text: string; tone: "success" | "error" } | null>(
    null
  );

  const dismissFlash = useCallback(() => setFlash(null), []);
  const dismissUndo = useCallback(() => setUndo(null), []);

  const run: DailyPanelRunFn = useCallback(
    (action, successMessage, pendingMessage = "Przetwarzanie…") => {
      setPendingMessage(pendingMessage);
      start(async () => {
        try {
          const result = await action();
          router.refresh();
          if (result.undo) {
            setFlash(null);
            setUndo({
              message: result.feedbackLines?.length
                ? `${successMessage} Sprawdź termin poniżej — masz 5 s na cofnięcie.`
                : `${successMessage} Masz 5 sekund na cofnięcie.`,
              detailLines: result.feedbackLines,
              payload: result.undo,
            });
          } else {
            setUndo(null);
            setFlash({ text: successMessage, tone: "success" });
          }
        } catch (e) {
          setUndo(null);
          setFlash({
            text: e instanceof Error ? e.message : "Wystąpił błąd",
            tone: "error",
          });
        } finally {
          setPendingMessage(null);
        }
      });
    },
    [router]
  );

  const handleUndo = useCallback(() => {
    if (!undo) return;
    const payload = undo.payload;
    setPendingMessage("Cofanie ostatniej akcji…");
    start(async () => {
      try {
        await actionUndoDailyPanelChange(payload);
        setUndo(null);
        setFlash({ text: "Cofnięto ostatnią akcję.", tone: "success" });
        router.refresh();
      } catch (e) {
        setFlash({
          text: e instanceof Error ? e.message : "Nie udało się cofnąć",
          tone: "error",
        });
        setUndo(null);
        router.refresh();
      } finally {
        setPendingMessage(null);
      }
    });
  }, [undo, router]);

  const notify = useCallback((text: string, tone: "success" | "error" = "success") => {
    setUndo(null);
    setFlash({ text, tone });
  }, []);

  return {
    pending,
    pendingMessage,
    run,
    notify,
    undo,
    dismissUndo,
    handleUndo,
    flash,
    dismissFlash,
  };
}
