"use client";

import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

export function ProsbaStockConfirmDialog({
  open,
  message,
  pending,
  confirmLabel = "Wyślij mimo to",
  cancelLabel = "Wróć do formularza",
  onCancel,
  onConfirm,
}: {
  open: boolean;
  message: string;
  pending?: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <ConfirmDialog
      open={open}
      title="Towar na stanie"
      message={message}
      confirmLabel={confirmLabel}
      cancelLabel={cancelLabel}
      pending={pending}
      tier="stack"
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}
