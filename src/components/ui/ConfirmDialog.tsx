"use client";

import { Button } from "@/components/ui/Button";
import { ModalShell, type ModalTier } from "@/components/ui/ModalShell";
import { IconAlertCircle } from "@/components/icons/StrokeIcons";

export function ConfirmDialog({
  open,
  title,
  message,
  summary,
  confirmLabel = "Potwierdź",
  cancelLabel = "Anuluj",
  danger,
  pending,
  tier = "raised",
  disableBackdropClose,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  /** Krótki lead nad treścią (np. „2 pozycje na stanie”). */
  summary?: string | null;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  pending?: boolean;
  tier?: ModalTier;
  /** Gdy true — klik w tło nie wywołuje onCancel (np. wymuszone wybory). */
  disableBackdropClose?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <ModalShell
      open={open}
      onClose={onCancel}
      title={title}
      titleId="confirm-title"
      describedById="confirm-message"
      role="alertdialog"
      size="sm"
      tier={tier}
      disableBackdropClose={pending || disableBackdropClose}
      loadingMessage={pending ? "Przetwarzanie…" : null}
      bodyClassName="space-y-3 px-5 py-4 sm:px-6"
      footer={
        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="ghost"
            className="min-h-11 w-full sm:w-auto"
            onClick={onCancel}
            disabled={pending}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={danger ? "danger" : "primary"}
            className="min-h-11 w-full sm:w-auto"
            onClick={onConfirm}
            disabled={pending}
          >
            {confirmLabel}
          </Button>
        </div>
      }
    >
      {summary ? (
        <div
          className="flex items-start gap-2.5 rounded-lg border border-amber-200/80 bg-amber-50/70 px-3.5 py-2.5 text-xs leading-relaxed text-amber-950"
          role="status"
          aria-live="polite"
        >
          <IconAlertCircle size={16} className="mt-0.5 shrink-0 text-amber-600" />
          <span className="min-w-0 flex-1 font-medium">{summary}</span>
        </div>
      ) : null}
      <p
        id="confirm-message"
        className="whitespace-pre-line text-sm leading-relaxed text-slate-600"
      >
        {message}
      </p>
    </ModalShell>
  );
}
