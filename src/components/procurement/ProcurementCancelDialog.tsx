"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { ModalShell } from "@/components/ui/ModalShell";
import { cn } from "@/lib/cn";
import {
  controlFocusClass,
  panelTypography,
} from "@/lib/ui/ontime-theme";
import { MAX_PROCUREMENT_CANCEL_NOTE_LEN } from "@/lib/security/text-limits";

type ProcurementCancelDialogProps = {
  open: boolean;
  title: string;
  message: string;
  headline?: string | null;
  confirmLabel?: string;
  cancelLabel?: string;
  pending?: boolean;
  onCancel: () => void;
  onConfirm: (note: string | undefined) => void;
};

function ProcurementCancelDialogForm({
  title,
  message,
  headline,
  confirmLabel = "Potwierdź",
  cancelLabel = "Anuluj",
  pending,
  onCancel,
  onConfirm,
}: Omit<ProcurementCancelDialogProps, "open">) {
  const [note, setNote] = useState("");

  const resetAndCancel = () => {
    setNote("");
    onCancel();
  };

  const handleConfirm = () => {
    const value = note.trim() || undefined;
    setNote("");
    onConfirm(value);
  };

  return (
    <ModalShell
      open
      onClose={resetAndCancel}
      title={title}
      titleId="procurement-cancel-title"
      role="alertdialog"
      size="sm"
      tier="raised"
      disableBackdropClose={pending}
      loadingMessage={pending ? "Przetwarzanie…" : null}
      bodyClassName="px-5 py-4 sm:px-6"
      footer={
        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="ghost"
            className="min-h-11 w-full sm:w-auto"
            onClick={resetAndCancel}
            disabled={pending}
          >
            {cancelLabel}
          </Button>
          <Button
            variant="danger"
            className="min-h-11 w-full sm:w-auto"
            onClick={handleConfirm}
            disabled={pending}
          >
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        {headline?.trim() ? (
          <p className="text-sm font-medium text-slate-900">{headline.trim()}</p>
        ) : null}
        <p className="text-sm leading-relaxed text-slate-600">{message}</p>
        <label className="block">
          <span className="text-[11px] font-medium text-slate-600">
            Wiadomość dla handlowca (opcjonalnie)
          </span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={MAX_PROCUREMENT_CANCEL_NOTE_LEN}
            disabled={pending}
            placeholder="np. brak towaru u dostawcy, duplikat prośby…"
            className={cn(
              "mt-1 w-full resize-y rounded-md border border-slate-200 px-2.5 py-1.5 text-xs text-slate-800 placeholder:text-slate-400",
              controlFocusClass
            )}
          />
          <p className={cn(panelTypography.caption, "mt-1")}>
            Handlowiec zobaczy tę wiadomość przy pozycji w Moje zamówienia.
          </p>
        </label>
      </div>
    </ModalShell>
  );
}

export function ProcurementCancelDialog({ open, ...props }: ProcurementCancelDialogProps) {
  if (!open) return null;
  return <ProcurementCancelDialogForm {...props} />;
}
