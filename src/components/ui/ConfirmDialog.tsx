"use client";

import { Button } from "@/components/ui/Button";
import { ModalShell, type ModalTier } from "@/components/ui/ModalShell";

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Potwierdź",
  cancelLabel = "Anuluj",
  danger,
  pending,
  tier = "raised",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  pending?: boolean;
  tier?: ModalTier;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <ModalShell
      open={open}
      onClose={onCancel}
      title={title}
      titleId="confirm-title"
      role="alertdialog"
      size="sm"
      tier={tier}
      disableBackdropClose={pending}
      loadingMessage={pending ? "Przetwarzanie…" : null}
      bodyClassName="px-5 py-4 sm:px-6"
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
      <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600">{message}</p>
    </ModalShell>
  );
}
