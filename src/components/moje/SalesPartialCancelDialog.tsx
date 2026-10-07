"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ModalShell } from "@/components/ui/ModalShell";
import { QtyStepButton } from "@/components/ui/QtyStepButton";
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
  // Tekst pola osobno od liczby — pusty lub „0” w trakcie pisania nie skacze od razu do 1.
  const [draft, setDraft] = useState(String(defaultQty));
  const inputId = useId();
  const clamp = (n: number) => Math.min(maxQty, Math.max(1, Math.trunc(n)));
  const commit = (n: number) => {
    const next = clamp(n);
    setQty(next);
    setDraft(String(next));
  };
  const draftValid = String(qty) === draft.trim();

  const copy = salesPartialCancelConfirmCopy(phase, product, qty, maxQty, deliveredQty);

  return (
    <ModalShell
      open={open}
      onClose={onCancel}
      title={copy.title}
      titleId="partial-cancel-title"
      role="alertdialog"
      size="sm"
      tier="stack"
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
            disabled={pending || !draftValid || qty < 1 || qty > maxQty}
          >
            {copy.confirmLabel}
          </Button>
        </div>
      }
    >
      <p className="text-sm leading-relaxed text-slate-600">{copy.message}</p>
      <div className="mt-4 flex items-center justify-center gap-3">
        <QtyStepButton
          direction="down"
          label="Zmniejsz ilość"
          disabled={pending || qty <= 1}
          onClick={() => commit(qty - 1)}
        />
        <div className="text-center">
          <label htmlFor={inputId} className="sr-only">
            Ilość do wycofania
          </label>
          <input
            id={inputId}
            type="number"
            inputMode="numeric"
            min={1}
            max={maxQty}
            step={1}
            value={draft}
            disabled={pending}
            aria-describedby={`${inputId}-max`}
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => {
              setDraft(e.target.value);
              const n = Number(e.target.value);
              if (Number.isInteger(n) && n >= 1 && n <= maxQty) setQty(n);
            }}
            onBlur={() => commit(Number(draft) || qty)}
            className="w-20 rounded-md border border-transparent bg-transparent py-0.5 text-center text-2xl font-semibold tabular-nums text-slate-900 transition-colors [appearance:textfield] hover:border-slate-200 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          <p id={`${inputId}-max`} className="text-[11px] text-slate-500">
            z {maxQty} szt.
          </p>
        </div>
        <QtyStepButton
          direction="up"
          label="Zwiększ ilość"
          disabled={pending || qty >= maxQty}
          onClick={() => commit(qty + 1)}
        />
      </div>
    </ModalShell>
  );
}
