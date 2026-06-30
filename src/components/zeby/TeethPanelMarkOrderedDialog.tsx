"use client";

import { useState } from "react";
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
  const analysisOrderKey = analysis?.orderIds.join(",") ?? "";
  const ackResetKey = open ? analysisOrderKey : "closed";
  const [ackMissingSpec, setAckMissingSpec] = useState(false);
  const [prevAckResetKey, setPrevAckResetKey] = useState(ackResetKey);
  if (ackResetKey !== prevAckResetKey) {
    setPrevAckResetKey(ackResetKey);
    setAckMissingSpec(false);
  }

  if (!analysis || analysis.orderIds.length === 0) return null;

  const needsAck = analysis.hasMissingSpec;
  const canConfirm = !needsAck || ackMissingSpec;

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
          <Button
            variant={needsAck ? "danger" : "primary"}
            className="min-h-11 w-full sm:w-auto"
            onClick={onConfirm}
            disabled={pending || !canConfirm}
          >
            {teethMarkOrderedConfirmLabel(analysis)}
          </Button>
        </div>
      }
    >
      <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600">
        {teethMarkOrderedConfirmMessage(analysis, supplierName)}
      </p>
      {needsAck ? (
        <label className="mt-4 flex cursor-pointer items-start gap-2.5 rounded-md border border-amber-200/90 bg-amber-50/80 px-3 py-2.5 text-sm text-amber-950">
          <input
            type="checkbox"
            checked={ackMissingSpec}
            onChange={(e) => setAckMissingSpec(e.target.checked)}
            className="mt-0.5 size-4 shrink-0 rounded border-amber-400 text-amber-700"
          />
          <span>
            Potwierdzam zamówienie u dostawcy mimo brakujących list zębów — biorę odpowiedzialność
            za weryfikację przed telefonem.
          </span>
        </label>
      ) : null}
    </ModalShell>
  );
}
