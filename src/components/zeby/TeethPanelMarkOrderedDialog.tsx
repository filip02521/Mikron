"use client";

import { Button } from "@/components/ui/Button";
import { ModalShell } from "@/components/ui/ModalShell";
import {
  teethMarkOrderedConfirmLabel,
  teethMarkOrderedConfirmMessage,
  type TeethMarkOrderedAnalysis,
} from "@/lib/teeth/teeth-mark-ordered";
import { TEETH_MARK_ORDERED_LABEL } from "@/components/zeby/teeth-panel-copy";

export function TeethPanelMarkOrderedDialog({
  open,
  analysis,
  supplierName,
  pending,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  analysis: TeethMarkOrderedAnalysis | null;
  supplierName?: string | null;
  pending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!analysis || analysis.orderIds.length === 0) return null;

  const canConfirm = analysis.canMarkAny;

  return (
    <ModalShell
      open={open}
      onClose={onCancel}
      title={TEETH_MARK_ORDERED_LABEL}
      role="alertdialog"
      size="sm"
      tier="raised"
      disableBackdropClose={pending}
      loadingMessage={pending ? "Oznaczanie…" : null}
      bodyClassName="px-5 py-4 sm:px-6"
      footer={
        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="ghost"
            className="min-h-11 w-full sm:w-auto"
            onClick={onCancel}
            disabled={pending}
          >
            Anuluj
          </Button>
          {canConfirm ? (
            <Button
              className="min-h-11 w-full sm:w-auto"
              onClick={onConfirm}
              disabled={pending}
            >
              {teethMarkOrderedConfirmLabel(analysis)}
            </Button>
          ) : null}
        </div>
      }
    >
      <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600">
        {teethMarkOrderedConfirmMessage(analysis, supplierName)}
      </p>
    </ModalShell>
  );
}
