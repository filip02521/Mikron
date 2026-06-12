"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { actionUndoDailyPanelChange } from "@/app/actions/admin";
import type { DailyPanelActionResult } from "@/lib/orders/daily-panel-undo";
import type { DailyPanelUndoPayload } from "@/lib/orders/daily-panel-undo";
import {
  isUndoPayloadExpired,
  undoPayloadExpiresAt,
  undoWindowBannerDescription,
} from "@/lib/orders/daily-panel-undo";
import { useAdminPanelPreview } from "@/components/layout/AdminPanelPreviewContext";
import { ADMIN_PANEL_PREVIEW_MUTATION_BLOCKED } from "@/lib/auth/admin-panel-preview-messages";

export const DAILY_PANEL_SCOPE_BULK = "__bulk__";
export const DAILY_PANEL_SCOPE_GLOBAL = "__global__";
export const DAILY_PANEL_SCOPE_PLAN = "__plan__";

export type DailyPanelRunOptions = {
  /** Id dostawcy, klucz grupy prośby, __bulk__, __plan__ itd. */
  scope?: string;
  /** Pełnoekranowy overlay — tylko undo i rzadkie operacje globalne */
  overlay?: boolean;
  /** Wywołane po udanej akcji (przed refresh). */
  onSuccess?: () => void;
};

export type DailyPanelRunFn = (
  action: () => Promise<DailyPanelActionResult>,
  successMessage: string,
  pendingMessage?: string,
  options?: DailyPanelRunOptions
) => void;

type UndoState = {
  title: string;
  description?: string;
  detailLines?: string[];
  payload: DailyPanelUndoPayload;
  expiresAt: number;
};

export function useDailyPanelRunner() {
  const router = useRouter();
  const { readOnly } = useAdminPanelPreview();
  const [isPending, start] = useTransition();
  const [pendingScope, setPendingScope] = useState<string | null>(null);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [undo, setUndo] = useState<UndoState | null>(null);
  const [flash, setFlash] = useState<{ text: string; tone: "success" | "error" } | null>(
    null
  );
  const undoPayloadRef = useRef<DailyPanelUndoPayload | null>(null);

  const dismissFlash = useCallback(() => setFlash(null), []);
  const dismissUndo = useCallback(() => {
    setUndo(null);
    undoPayloadRef.current = null;
  }, []);

  const isScopePending = useCallback(
    (scope: string) => isPending && pendingScope === scope,
    [isPending, pendingScope]
  );

  const isBulkPending = isScopePending(DAILY_PANEL_SCOPE_BULK);
  const isGlobalPending = isScopePending(DAILY_PANEL_SCOPE_GLOBAL);
  const isPlanPending = isScopePending(DAILY_PANEL_SCOPE_PLAN);

  const run: DailyPanelRunFn = useCallback(
    (action, successMessage, pendingMsg = "Przetwarzanie…", options) => {
      if (readOnly) {
        setFlash({ text: ADMIN_PANEL_PREVIEW_MUTATION_BLOCKED, tone: "error" });
        return;
      }

      const scope = options?.scope ?? DAILY_PANEL_SCOPE_GLOBAL;
      const useOverlay = options?.overlay ?? scope === DAILY_PANEL_SCOPE_GLOBAL;

      setPendingScope(scope);
      if (useOverlay) {
        setPendingMessage(pendingMsg);
      }

      start(async () => {
        try {
          const result = await action();
          if (result.undo) {
            const expiresAt = undoPayloadExpiresAt(result.undo);
            undoPayloadRef.current = result.undo;
            setFlash(null);
            setUndo({
              title: successMessage,
              description: undoWindowBannerDescription(
                result.feedbackLines?.length ? "Sprawdź terminy poniżej" : undefined
              ),
              detailLines: result.feedbackLines,
              payload: result.undo,
              expiresAt,
            });
          } else {
            setUndo(null);
            undoPayloadRef.current = null;
            setFlash({ text: successMessage, tone: "success" });
          }
          options?.onSuccess?.();
          router.refresh();
        } catch (e) {
          setUndo(null);
          undoPayloadRef.current = null;
          setFlash({
            text: e instanceof Error ? e.message : "Wystąpił błąd",
            tone: "error",
          });
        } finally {
          setPendingScope(null);
          setPendingMessage(null);
        }
      });
    },
    [readOnly, router]
  );

  const handleUndo = useCallback(() => {
    if (readOnly) {
      setFlash({ text: ADMIN_PANEL_PREVIEW_MUTATION_BLOCKED, tone: "error" });
      return;
    }
    const payload = undo?.payload ?? undoPayloadRef.current;
    if (!payload) return;
    if (isUndoPayloadExpired(payload)) {
      setUndo(null);
      undoPayloadRef.current = null;
      setFlash({
        text: "Minął czas na cofnięcie — odśwież panel.",
        tone: "error",
      });
      return;
    }
    setPendingScope(DAILY_PANEL_SCOPE_GLOBAL);
    setPendingMessage("Cofanie ostatniej akcji…");
    start(async () => {
      try {
        await actionUndoDailyPanelChange(payload);
        setUndo(null);
        undoPayloadRef.current = null;
        setFlash({ text: "Cofnięto ostatnią akcję.", tone: "success" });
        router.refresh();
      } catch (e) {
        const message = e instanceof Error ? e.message : "Nie udało się cofnąć";
        setFlash({ text: message, tone: "error" });
        if (isUndoPayloadExpired(payload)) {
          setUndo(null);
          undoPayloadRef.current = null;
        }
        router.refresh();
      } finally {
        setPendingScope(null);
        setPendingMessage(null);
      }
    });
  }, [readOnly, undo, router]);

  const notify = useCallback((text: string, tone: "success" | "error" = "success") => {
    setUndo(null);
    undoPayloadRef.current = null;
    setFlash({ text, tone });
  }, []);

  return {
    pending: isPending,
    pendingMessage,
    pendingScope,
    isScopePending,
    isBulkPending,
    isGlobalPending,
    isPlanPending,
    run,
    notify,
    undo,
    dismissUndo,
    handleUndo,
    flash,
    dismissFlash,
  };
}
