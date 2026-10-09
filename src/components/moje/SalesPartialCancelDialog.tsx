"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ModalShell } from "@/components/ui/ModalShell";
import { QtyStepButton } from "@/components/ui/QtyStepButton";
import { cn } from "@/lib/cn";
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
  // Od bieżącej wartości, nie z domknięcia — szybkie dwa kliknięcia „+” to dwa kroki.
  const step = (delta: number) =>
    setQty((prev) => {
      const next = clamp(prev + delta);
      setDraft(String(next));
      return next;
    });
  // Liczbowo, nie tekstowo: „012” to nadal 12. Pusty albo spoza zakresu — przycisk wyłączony i komunikat pod polem.
  const draftNum = Number(draft);
  const draftValid = draft.trim() !== "" && draftNum === qty;
  const draftOutOfRange =
    draft.trim() !== "" &&
    (!Number.isInteger(draftNum) || draftNum < 1 || draftNum > maxQty);

  const copy = salesPartialCancelConfirmCopy(phase, product, qty, maxQty, deliveredQty);
  // Oddanie sztuk, które już leżą na magazynie, to inna decyzja niż rezygnacja z brakujących — wyróżnij ją.
  const touchesStock = phase === "on_stock" && qty > Math.max(0, maxQty - deliveredQty);

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
      <p className="text-sm font-medium leading-snug text-slate-900">{product}</p>
      {copy.facts.length ? (
        <dl className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200 text-sm">
          {copy.facts.map((f) => (
            <div key={f.label} className="flex items-baseline justify-between gap-3 px-3 py-2">
              <dt className="text-slate-600">{f.label}</dt>
              <dd className="shrink-0 font-semibold tabular-nums text-slate-900">{f.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      <div className="mt-4 text-center">
        <label htmlFor={inputId} className="text-sm font-medium text-slate-800">
          Ile sztuk wycofać?
        </label>
      </div>
      <div className="mt-2 flex items-center justify-center gap-3">
        <QtyStepButton
          direction="down"
          label="Wycofaj o 1 szt. mniej"
          disabled={pending || qty <= 1}
          onClick={() => step(-1)}
        />
        <div className="text-center">
          <input
            id={inputId}
            type="number"
            inputMode="numeric"
            min={1}
            max={maxQty}
            step={1}
            value={draft}
            disabled={pending}
            aria-describedby={`${inputId}-max ${inputId}-outcome`}
            aria-invalid={draftOutOfRange || undefined}
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => {
              setDraft(e.target.value);
              const n = Number(e.target.value);
              if (Number.isInteger(n) && n >= 1 && n <= maxQty) setQty(n);
            }}
            onBlur={() => commit(Number(draft) || qty)}
            className="w-20 rounded-md border border-slate-200 bg-white py-0.5 text-center text-2xl font-semibold tabular-nums text-slate-900 transition-colors [appearance:textfield] hover:border-slate-300 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 aria-[invalid=true]:border-red-400 aria-[invalid=true]:focus:ring-red-500/20 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          <p
            id={`${inputId}-max`}
            className={draftOutOfRange ? "text-[11px] font-medium text-red-700" : "text-[11px] text-slate-500"}
            aria-live="polite"
          >
            {draftOutOfRange ? `Wpisz od 1 do ${maxQty}` : `od 1 do ${maxQty} szt.`}
          </p>
        </div>
        <QtyStepButton
          direction="up"
          label="Wycofaj o 1 szt. więcej"
          disabled={pending || qty >= maxQty}
          onClick={() => step(1)}
        />
      </div>
      <p
        id={`${inputId}-outcome`}
        aria-live="polite"
        className={cn(
          "mt-4 rounded-lg px-3 py-2.5 text-sm leading-relaxed transition-colors duration-150",
          touchesStock
            ? "bg-amber-50 text-amber-900 ring-1 ring-inset ring-amber-300"
            : "bg-indigo-50 text-slate-800 ring-1 ring-inset ring-indigo-100"
        )}
      >
        <span className="font-semibold">Po zmianie: </span>
        {copy.outcome}
      </p>
      <p className="mt-3 text-xs leading-relaxed text-slate-500">{copy.undoHint}</p>
    </ModalShell>
  );
}
