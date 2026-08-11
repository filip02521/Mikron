"use client";

import { useId, useState } from "react";
import type { ManualZdEstimateLine } from "@/lib/orders/zd-estimate-manual";
import { formatQty } from "@/lib/orders/zd-estimate-manual";
import { IconClipboardList } from "@/components/icons/StrokeIcons";
import { Button } from "@/components/ui/Button";
import { ModalShell } from "@/components/ui/ModalShell";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/cn";
import { controlFocusClass, panelTypography } from "@/lib/ui/ontime-theme";

function ExcludeDialogForm({
  line,
  pending,
  onCancel,
  onConfirm,
}: {
  line: ManualZdEstimateLine;
  pending?: boolean;
  onCancel: () => void;
  onConfirm: (note: string) => void;
}) {
  const noteId = useId();
  const [note, setNote] = useState("");
  const qty = line.doZamowieniaReczne;

  return (
    <ModalShell
      open
      onClose={onCancel}
      title="Wyklucz z listy"
      titleHint="Produkt zniknie z „Do ZD” przy kolejnych szacunkach, aż go przywrócisz. Lista jest wspólna dla działu zakupów."
      titleId="zd-estimate-exclude-title"
      size="md"
      tier="raised"
      disableBackdropClose={pending}
      bodyClassName="space-y-4 px-5 py-5 sm:px-6"
      loadingMessage={pending ? "Zapisuję…" : null}
      footer={
        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="ghost"
            className="min-h-11 w-full sm:w-auto"
            onClick={onCancel}
            disabled={pending}
          >
            Anuluj
          </Button>
          <Button
            type="button"
            variant="danger"
            className="min-h-11 w-full sm:w-auto"
            onClick={() => onConfirm(note.trim())}
            disabled={pending}
          >
            {pending ? (
              <span className="inline-flex items-center gap-2">
                <Spinner className="size-4" /> Zapisuję…
              </span>
            ) : (
              "Wyklucz na stałe"
            )}
          </Button>
        </div>
      }
    >
      <div className="rounded-lg border border-slate-200/90 bg-slate-50/70 px-3.5 py-3">
        <div className="flex gap-3">
          <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md bg-white text-slate-500 ring-1 ring-slate-200/80">
            <IconClipboardList size={18} strokeWidth={1.75} aria-hidden />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <p className="font-semibold tabular-nums tracking-tight text-slate-900">
                {line.tw_Symbol}
              </p>
              {line.grt_Nazwa && line.grt_Nazwa !== "—" ? (
                <span className="rounded bg-slate-200/70 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                  {line.grt_Nazwa}
                </span>
              ) : null}
            </div>
            <p className="text-sm leading-snug text-slate-600">{line.tw_Nazwa}</p>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 pt-0.5 text-[11px] tabular-nums text-slate-500">
              <span>
                Do zam.{" "}
                <span
                  className={cn(
                    "font-semibold",
                    qty > 0 ? "text-emerald-800" : "text-slate-400"
                  )}
                >
                  {qty}
                </span>
              </span>
              <span>
                Stan{" "}
                <span className="font-medium text-slate-700">
                  {formatQty(line.tw_Stan)}
                </span>
              </span>
              <span>
                Dostępne{" "}
                <span className="font-medium text-slate-700">
                  {formatQty(line.dostepne)}
                </span>
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-amber-200/70 bg-amber-50/45 px-3 py-2.5">
        <p className="text-xs font-semibold text-amber-950">
          Pomijany przy kolejnych zamówieniach
        </p>
        <p className="mt-0.5 text-[11px] leading-snug text-amber-900/85">
          Nie wejdzie do sumy sztuk ani eksportu TSV, dopóki ktoś z działu go nie
          przywróci na liście wykluczeń.
        </p>
      </div>

      <label htmlFor={noteId} className="block">
        <span className="text-xs font-medium text-slate-600">
          Notatka{" "}
          <span className="font-normal text-slate-400">(opcjonalnie)</span>
        </span>
        <textarea
          id={noteId}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          maxLength={500}
          disabled={pending}
          placeholder="np. wycofany, zamiennik, nie zamawiamy…"
          autoFocus
          className={cn(
            "mt-1.5 w-full resize-y rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400",
            controlFocusClass
          )}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              onCancel();
            }
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              onConfirm(note.trim());
            }
          }}
        />
        <div className="mt-1 flex items-center justify-between gap-2">
          <p className={panelTypography.caption}>
            Widoczna dla całego działu zakupów
          </p>
          <p className="text-[11px] tabular-nums text-slate-400">
            {note.length}/500
          </p>
        </div>
      </label>
    </ModalShell>
  );
}

export function ZdEstimateExcludeDialog({
  open,
  line,
  pending,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  line: ManualZdEstimateLine | null;
  pending?: boolean;
  onCancel: () => void;
  onConfirm: (note: string) => void;
}) {
  if (!open || !line) return null;

  return (
    <ExcludeDialogForm
      key={line.tw_Id}
      line={line}
      pending={pending}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}
