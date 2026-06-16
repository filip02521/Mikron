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

type ProcurementCancelNoteEditModalProps = {
  open: boolean;
  initialNote?: string | null;
  pending?: boolean;
  onCancel: () => void;
  onConfirm: (note: string | undefined) => void;
};

function ProcurementCancelNoteEditModalForm({
  initialNote,
  pending,
  onCancel,
  onConfirm,
}: Omit<ProcurementCancelNoteEditModalProps, "open">) {
  const [note, setNote] = useState(initialNote?.trim() ?? "");

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
      title="Edytuj wiadomość dla handlowca"
      titleId="procurement-cancel-note-edit-title"
      size="sm"
      tier="raised"
      disableBackdropClose={pending}
      loadingMessage={pending ? "Zapisywanie…" : null}
      bodyClassName="px-5 py-4 sm:px-6"
      footer={
        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="ghost"
            className="min-h-11 w-full sm:w-auto"
            onClick={resetAndCancel}
            disabled={pending}
          >
            Anuluj
          </Button>
          <Button
            className="min-h-11 w-full sm:w-auto"
            onClick={handleConfirm}
            disabled={pending}
          >
            Zapisz
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <p className="text-sm leading-relaxed text-slate-600">
          Handlowiec zobaczy zaktualizowaną wiadomość przy pozycji w Moje zamówienia i
          otrzyma powiadomienie e-mail.
        </p>
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
            Puste pole usunie wiadomość przy pozycji.
          </p>
        </label>
      </div>
    </ModalShell>
  );
}

export function ProcurementCancelNoteEditModal({
  open,
  initialNote,
  ...props
}: ProcurementCancelNoteEditModalProps) {
  if (!open) return null;
  return (
    <ProcurementCancelNoteEditModalForm
      key={initialNote ?? ""}
      initialNote={initialNote}
      {...props}
    />
  );
}
