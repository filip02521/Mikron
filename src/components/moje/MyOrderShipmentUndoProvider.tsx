"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  actionUnacknowledgeDismiss,
  actionUnacknowledgePickup,
  actionUnacknowledgeSalesCancel,
} from "@/app/actions/my-orders";
import { UndoToast } from "@/components/ui/UndoToast";
import { Toast } from "@/components/ui/Toast";
import { undoWindowBannerDescription } from "@/lib/orders/daily-panel-undo";
import { undoShortcutLabel } from "@/lib/platform/keyboard-shortcut-label";

export type ShipmentUndoState = {
  orderIds: string[];
  title: string;
  kind: "pickup" | "dismiss" | "cancel";
};

type ShipmentUndoContextValue = {
  undo: ShipmentUndoState | null;
  undoError: string | null;
  reportUndo: (state: ShipmentUndoState) => void;
  clearUndo: () => void;
  clearUndoError: () => void;
  handleUndo: () => void;
  disabled: boolean;
};

const ShipmentUndoContext = createContext<ShipmentUndoContextValue | null>(null);

function shipmentUndoCopy(state: ShipmentUndoState): {
  undoLabel: string;
  description: string;
} {
  if (state.kind === "pickup") {
    return {
      undoLabel: "Cofnij odbiór",
      description: undoWindowBannerDescription("Towar wróci na listę gotowych"),
    };
  }
  if (state.kind === "cancel") {
    return {
      undoLabel: "Cofnij anulowanie",
      description: undoWindowBannerDescription("Pozycja wróci na listę"),
    };
  }
  return {
    undoLabel: "Cofnij ukrycie",
    description: undoWindowBannerDescription("Prośba wróci na listę"),
  };
}

function undoFailureMessage(kind: ShipmentUndoState["kind"]): string {
  if (kind === "pickup") {
    return "Nie udało się cofnąć odbioru. Spróbuj ponownie.";
  }
  if (kind === "cancel") {
    return "Nie udało się cofnąć anulowania. Spróbuj ponownie.";
  }
  return "Nie udało się cofnąć ukrycia. Spróbuj ponownie.";
}

/** Jeden toast cofnięcia na widoku /moje — unika duplikatów z wielu list. */
export function MyOrderShipmentUndoProvider({
  children,
  disabled = false,
}: {
  children: ReactNode;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [undo, setUndo] = useState<ShipmentUndoState | null>(null);
  const [undoError, setUndoError] = useState<string | null>(null);
  const [, start] = useTransition();

  const clearUndoError = useCallback(() => setUndoError(null), []);

  const clearUndo = useCallback(() => {
    setUndo(null);
    setUndoError(null);
  }, []);

  const reportUndo = useCallback(
    (state: ShipmentUndoState) => {
      if (disabled) return;
      setUndoError(null);
      setUndo(state);
    },
    [disabled]
  );

  const handleUndo = useCallback(() => {
    if (!undo || disabled) return;
    const snapshot = undo;
    setUndoError(null);
    start(async () => {
      try {
        if (snapshot.kind === "dismiss") {
          await actionUnacknowledgeDismiss(snapshot.orderIds);
        } else if (snapshot.kind === "cancel") {
          await actionUnacknowledgeSalesCancel(snapshot.orderIds);
        } else {
          await actionUnacknowledgePickup(snapshot.orderIds);
        }
        setUndo(null);
        router.refresh();
      } catch {
        setUndo(snapshot);
        setUndoError(undoFailureMessage(snapshot.kind));
        router.refresh();
      }
    });
  }, [undo, disabled, router]);

  return (
    <ShipmentUndoContext.Provider
      value={{
        undo,
        undoError,
        reportUndo,
        clearUndo,
        clearUndoError,
        handleUndo,
        disabled,
      }}
    >
      {children}
    </ShipmentUndoContext.Provider>
  );
}

/** Toast cofnięcia — pływający u dołu ekranu, widoczny niezależnie od scrolla listy. */
export function MyOrderShipmentUndoToast() {
  const ctx = useContext(ShipmentUndoContext);
  const [mounted, setMounted] = useState(false);
  const undo = ctx?.undo ?? null;
  const undoError = ctx?.undoError ?? null;
  const disabled = ctx?.disabled ?? true;
  const handleUndo = ctx?.handleUndo;
  const clearUndo = ctx?.clearUndo;
  const clearUndoError = ctx?.clearUndoError;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!undo || disabled || !handleUndo) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "z") return;
      event.preventDefault();
      handleUndo();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undo, disabled, handleUndo]);

  if (!mounted || disabled) return null;

  const portals: React.ReactNode[] = [];

  if (undo && clearUndo && handleUndo) {
    const copy = shipmentUndoCopy(undo);
    portals.push(
      <UndoToast
        key="undo"
        title={undo.title}
        description={copy.description}
        undoLabel={copy.undoLabel}
        undoShortcut={undoShortcutLabel()}
        placement="floating"
        onDismiss={clearUndo}
        onUndo={handleUndo}
      />
    );
  }

  if (undoError && clearUndoError) {
    portals.push(
      <Toast
        key="undo-error"
        message={undoError}
        tone="error"
        durationMs={8000}
        onDismiss={clearUndoError}
      />
    );
  }

  if (!portals.length) return null;

  return createPortal(<>{portals}</>, document.body);
}

export function useMyOrderShipmentUndo(): ShipmentUndoContextValue {
  const ctx = useContext(ShipmentUndoContext);
  if (!ctx) {
    throw new Error("useMyOrderShipmentUndo wymaga MyOrderShipmentUndoProvider");
  }
  return ctx;
}
