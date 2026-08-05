"use client";
import { ADMIN_PREVIEW_TOAST, DAILY_PANEL_TOAST, toastFromError, toastSuccess, type ToastNotice } from "@/lib/ui/notice-copy";

import { useCallback, useEffect, useRef, useState, useTransition, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { actionUndoDailyPanelChange } from "@/app/actions/admin";
import type { DailyPanelActionResult } from "@/lib/orders/daily-panel-undo";
import type { DailyPanelUndoPayload } from "@/lib/orders/daily-panel-undo";
import {
  isUndoPayloadExpired,
  undoWindowBannerDescription,
} from "@/lib/orders/daily-panel-undo";
import {
  clearDailyPanelUndo,
  consumeDailyPanelUndoRefreshFlag,
  getDailyPanelUndoServerSnapshot,
  getDailyPanelUndoSnapshot,
  setDailyPanelUndoFromAction,
  subscribeDailyPanelUndo,
} from "@/lib/client/daily-panel-undo-store";
import { invalidateProcurementFlagOptimistic } from "@/lib/orders/procurement-flag-optimistic";
import { useAdminPanelPreview } from "@/components/layout/AdminPanelPreviewContext";
import { ACTION_PENDING_SAFETY_FORM_MS } from "@/lib/timing";

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
  /** Wywołane po nieudanej akcji (przed refresh). */
  onError?: () => void;
};

export type DailyPanelRunFn = (
  action: () => Promise<DailyPanelActionResult>,
  successMessage: string,
  pendingMessage?: string,
  options?: DailyPanelRunOptions
) => void;

export function useDailyPanelRunner() {
  const router = useRouter();
  const { readOnly } = useAdminPanelPreview();
  const [isPending, start] = useTransition();
  const [pendingScope, setPendingScope] = useState<string | null>(null);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const undo = useSyncExternalStore(
    subscribeDailyPanelUndo,
    getDailyPanelUndoSnapshot,
    getDailyPanelUndoServerSnapshot
  );
  const [flash, setFlash] = useState<ToastNotice | null>(null);
  const undoPayloadRef = useRef<DailyPanelUndoPayload | null>(null);
  const safetyTimerRef = useRef<number | null>(null);
  const needsRefreshRef = useRef(false);

  useEffect(() => {
    if (!isPending && needsRefreshRef.current) {
      needsRefreshRef.current = false;
      router.refresh();
    }
  }, [isPending, router]);

  useEffect(() => {
    return () => {
      if (safetyTimerRef.current) window.clearTimeout(safetyTimerRef.current);
    };
  }, []);

  const clearSafetyTimer = useCallback(() => {
    if (safetyTimerRef.current) {
      window.clearTimeout(safetyTimerRef.current);
      safetyTimerRef.current = null;
    }
  }, []);

  const startSafetyTimer = useCallback(() => {
    clearSafetyTimer();
    safetyTimerRef.current = window.setTimeout(() => {
      setPendingScope(null);
      setPendingMessage(null);
    }, ACTION_PENDING_SAFETY_FORM_MS);
  }, [clearSafetyTimer]);

  const dismissFlash = useCallback(() => setFlash(null), []);

  const dismissUndo = useCallback(() => {
    clearDailyPanelUndo();
    undoPayloadRef.current = null;
    if (consumeDailyPanelUndoRefreshFlag()) {
      router.refresh();
    }
  }, [router]);

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
        options?.onError?.();
        return;
      }

      const scope = options?.scope ?? DAILY_PANEL_SCOPE_GLOBAL;
      const useOverlay = options?.overlay ?? scope === DAILY_PANEL_SCOPE_GLOBAL;

      setPendingScope(scope);
      if (useOverlay) {
        setPendingMessage(pendingMsg);
      }
      startSafetyTimer();

      start(async () => {
        try {
          const result = await action();
          if (result.undo) {
            undoPayloadRef.current = result.undo;
            setFlash(null);
            setDailyPanelUndoFromAction({
              title: successMessage,
              description: undoWindowBannerDescription(
                result.feedbackLines?.length ? "Sprawdź terminy poniżej" : undefined
              ),
              detailLines: result.feedbackLines,
              payload: result.undo,
            });
            // Nie ustawiaj needsRefreshRef — revalidatePath z akcji odświeża dane;
            // natychmiastowy router.refresh() + remount layoutu gubił toast (Główne/Poboczne).
            // Refresh po dismissUndo / udanym Cofnij (flaga w store).
          } else {
            clearDailyPanelUndo();
            undoPayloadRef.current = null;
            consumeDailyPanelUndoRefreshFlag();
            setFlash(toastSuccess(successMessage));
            needsRefreshRef.current = true;
          }
          options?.onSuccess?.();
        } catch (e) {
          clearDailyPanelUndo();
          undoPayloadRef.current = null;
          consumeDailyPanelUndoRefreshFlag();
          setFlash(toastFromError(e instanceof Error ? e.message : undefined, DAILY_PANEL_TOAST.genericError.text));
          needsRefreshRef.current = true;
          options?.onError?.();
        } finally {
          clearSafetyTimer();
          setPendingScope(null);
          setPendingMessage(null);
        }
      });
    },
    [readOnly, startSafetyTimer, clearSafetyTimer]
  );

  const handleUndo = useCallback(() => {
    if (readOnly) {
      setFlash(ADMIN_PREVIEW_TOAST);
      return;
    }
    const payload = undo?.payload ?? undoPayloadRef.current;
    if (!payload) return;
    if (isUndoPayloadExpired(payload)) {
      clearDailyPanelUndo();
      undoPayloadRef.current = null;
      consumeDailyPanelUndoRefreshFlag();
      setFlash(DAILY_PANEL_TOAST.undoExpired);
      needsRefreshRef.current = true;
      return;
    }
    setPendingScope(DAILY_PANEL_SCOPE_GLOBAL);
    setPendingMessage("Cofanie ostatniej akcji…");
    startSafetyTimer();
    start(async () => {
      try {
        await actionUndoDailyPanelChange(payload);
        clearDailyPanelUndo();
        undoPayloadRef.current = null;
        consumeDailyPanelUndoRefreshFlag();
        invalidateProcurementFlagOptimistic();
        setFlash(DAILY_PANEL_TOAST.undoSuccess);
        needsRefreshRef.current = true;
      } catch (e) {
        const message = e instanceof Error ? e.message : "Nie udało się cofnąć";
        setFlash(toastFromError(message, DAILY_PANEL_TOAST.undoFailed.text));
        if (isUndoPayloadExpired(payload)) {
          clearDailyPanelUndo();
          undoPayloadRef.current = null;
          consumeDailyPanelUndoRefreshFlag();
        }
        needsRefreshRef.current = true;
      } finally {
        clearSafetyTimer();
        setPendingScope(null);
        setPendingMessage(null);
      }
    });
  }, [readOnly, undo, startSafetyTimer, clearSafetyTimer]);

  const notify = useCallback((text: string, tone: "success" | "error" = "success") => {
    clearDailyPanelUndo();
    undoPayloadRef.current = null;
    consumeDailyPanelUndoRefreshFlag();
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
