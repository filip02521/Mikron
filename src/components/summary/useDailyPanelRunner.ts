"use client";
import { ADMIN_PREVIEW_TOAST, DAILY_PANEL_TOAST, toastFromError, toastSuccess, type ToastNotice } from "@/lib/ui/notice-copy";

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
  const [flash, setFlash] = useState<ToastNotice | null>(null);
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
        setFlash(ADMIN_PREVIEW_TOAST);
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
            setFlash(toastSuccess(successMessage));
          }
          options?.onSuccess?.();
          router.refresh();
        } catch (e) {
          setUndo(null);
          undoPayloadRef.current = null;
          setFlash(toastFromError(e instanceof Error ? e.message : undefined, DAILY_PANEL_TOAST.genericError.text));
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
      setFlash(ADMIN_PREVIEW_TOAST);
      return;
    }
    const payload = undo?.payload ?? undoPayloadRef.current;
    if (!payload) return;
    if (isUndoPayloadExpired(payload)) {
      setUndo(null);
      undoPayloadRef.current = null;
      setFlash(DAILY_PANEL_TOAST.undoExpired);
      return;
    }
    setPendingScope(DAILY_PANEL_SCOPE_GLOBAL);
    setPendingMessage("Cofanie ostatniej akcji…");
    start(async () => {
      try {
        await actionUndoDailyPanelChange(payload);
        setUndo(null);
        undoPayloadRef.current = null;
        setFlash(DAILY_PANEL_TOAST.undoSuccess);
        router.refresh();
      } catch (e) {
        const message = e instanceof Error ? e.message : "Nie udało się cofnąć";
        setFlash(toastFromError(message, DAILY_PANEL_TOAST.undoFailed.text));
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
    setFlash(tone === "error" ? toastFromError(text) : toastSuccess(text));
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
