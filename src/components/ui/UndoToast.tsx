"use client";

import { useEffect } from "react";
import { cn } from "@/lib/cn";
import { floatingToastBottomClass } from "@/lib/ui/sales-mobile-chrome";
import { Button } from "@/components/ui/Button";

export function UndoToast({
  message,
  detailLines,
  tone = "success",
  onDismiss,
  onUndo,
  undoLabel = "Cofnij",
  durationMs = 5000,
}: {
  message: string;
  detailLines?: string[];
  tone?: "success" | "error";
  onDismiss: () => void;
  onUndo?: () => void;
  undoLabel?: string;
  durationMs?: number;
}) {
  useEffect(() => {
    const t = setTimeout(onDismiss, durationMs);
    return () => clearTimeout(t);
  }, [message, durationMs, onDismiss]);

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "fixed z-[60] flex max-w-[min(100vw-1.5rem,28rem)] flex-col gap-2 rounded-xl border px-4 py-3 text-sm font-medium shadow-lg",
        floatingToastBottomClass,
        "left-4 right-4 sm:left-auto sm:right-6",
        tone === "success"
          ? "border-emerald-200 bg-emerald-50 text-emerald-900"
          : "border-red-200 bg-red-50 text-red-900"
      )}
    >
      <p className="leading-snug">{message}</p>
      {detailLines?.length ? (
        <ul
          className={cn(
            "max-h-40 space-y-1.5 overflow-y-auto border-t pt-2 text-xs font-normal leading-snug",
            tone === "success"
              ? "border-emerald-200/80 text-emerald-950/90"
              : "border-red-200/80 text-red-950/90"
          )}
        >
          {detailLines.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      ) : null}
      {onUndo ? (
        <UndoActions onUndo={onUndo} onDismiss={onDismiss} undoLabel={undoLabel} />
      ) : null}
    </div>
  );
}

function UndoActions({
  onUndo,
  onDismiss,
  undoLabel,
}: {
  onUndo: () => void;
  onDismiss: () => void;
  undoLabel: string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        size="sm"
        variant="secondary"
        className="min-h-10 flex-1 sm:flex-none"
        onClick={onUndo}
      >
        {undoLabel}
      </Button>
      <Button size="sm" variant="ghost" className="min-h-10 text-slate-600" onClick={onDismiss}>
        Zamknij
      </Button>
    </div>
  );
}
