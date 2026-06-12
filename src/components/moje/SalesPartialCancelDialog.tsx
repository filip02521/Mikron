"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { ModalShell } from "@/components/ui/ModalShell";
import {
  salesPartialCancelConfirmCopy,
  type SalesCancelPhase,
} from "@/lib/orders/sales-cancel";

export function SalesPartialCancelDialog({
  open,
  product,
  phase,
  maxQty,
  defaultQty,
  deliveredQty = 0,
  pending,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  product: string;
  phase: SalesCancelPhase;
  maxQty: number;
  defaultQty: number;
  deliveredQty?: number;
  pending?: boolean;
  onConfirm: (quantity: number) => void;
  onCancel: () => void;
}) {
  const [qty, setQty] = useState(defaultQty);

  const copy = salesPartialCancelConfirmCopy(phase, product, qty, maxQty, deliveredQty);

  return (
    <ModalShell
      open={open}
      onClose={onCancel}
      title={copy.title}
      titleId="partial-cancel-title"
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
            onClick={onCancel}
            disabled={pending}
          >
            Zostaw bez zmian
          </Button>
          <Button
            variant="danger"
            className="min-h-11 w-full sm:w-auto"
            onClick={() => onConfirm(qty)}
            disabled={pending || qty < 1 || qty > maxQty}
          >
            {copy.confirmLabel}
          </Button>
        </div>
      }
    >
      <p className="text-sm leading-relaxed text-slate-600">{copy.message}</p>
      <div className="mt-4 flex items-center justify-center gap-3">
        <button
          type="button"
          className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 text-lg font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          disabled={pending || qty <= 1}
          aria-label="Zmniejsz ilość"
          onClick={() => setQty((v) => Math.max(1, v - 1))}
        >
          −
        </button>
        <div className="min-w-[4.5rem] text-center">
          <span className="text-2xl font-semibold tabular-nums text-slate-900">{qty}</span>
          <p className="text-[11px] text-slate-500">z {maxQty} szt.</p>
        </div>
        <button
          type="button"
          className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 text-lg font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          disabled={pending || qty >= maxQty}
          aria-label="Zwiększ ilość"
          onClick={() => setQty((v) => Math.min(maxQty, v + 1))}
        >
          +
        </button>
      </div>
    </ModalShell>
  );
}
