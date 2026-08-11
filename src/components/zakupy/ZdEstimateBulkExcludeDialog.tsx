"use client";

import { useId, useState } from "react";
import { IconClipboardList } from "@/components/icons/StrokeIcons";
import { Button } from "@/components/ui/Button";
import { ModalShell } from "@/components/ui/ModalShell";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/cn";
import { controlFocusClass, panelTypography } from "@/lib/ui/ontime-theme";
import { ZD_ESTIMATE_BULK_MAX } from "@/lib/orders/zd-estimate-bulk";

export type ZdEstimateBulkLinePreview = {
  tw_Id: number;
  tw_Symbol: string;
  tw_Nazwa: string;
};

export function ZdEstimateBulkExcludeDialog({
  open,
  lines,
  pending,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  lines: ZdEstimateBulkLinePreview[];
  pending?: boolean;
  onCancel: () => void;
  onConfirm: (note: string) => void;
}) {
  const noteId = useId();
  const [note, setNote] = useState("");

  if (!open || lines.length === 0) return null;

  const preview = lines.slice(0, 8);
  const rest = lines.length - preview.length;
  const overLimit = lines.length > ZD_ESTIMATE_BULK_MAX;
  const actionCount = Math.min(lines.length, ZD_ESTIMATE_BULK_MAX);

  return (
    <ModalShell
      open
      onClose={onCancel}
      title={`Wyklucz ${actionCount}${overLimit ? ` z ${lines.length}` : ""} ${actionCount === 1 ? "produkt" : "produktów"}`}
      titleHint="Zaznaczone produkty znikną z „Do zamówienia” przy kolejnych szacunkach. Lista jest wspólna dla działu zakupów."
      titleId="zd-estimate-bulk-exclude-title"
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
              `Wyklucz ${actionCount}`
            )}
          </Button>
        </div>
      }
    >
      <div className="rounded-xl border border-slate-200/90 bg-slate-50/70 px-3.5 py-3">
        <div className="flex gap-3">
          <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md bg-white text-slate-500 ring-1 ring-slate-200/80">
            <IconClipboardList size={18} strokeWidth={1.75} aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-900">
              Zaznaczone produkty
            </p>
            <ul className="mt-1.5 space-y-1">
              {preview.map((l) => (
                <li
                  key={l.tw_Id}
                  className="flex min-w-0 items-baseline gap-2 text-sm"
                >
                  <span className="shrink-0 font-semibold tabular-nums text-slate-900">
                    {l.tw_Symbol}
                  </span>
                  <span className="min-w-0 truncate text-slate-600">
                    {l.tw_Nazwa}
                  </span>
                </li>
              ))}
            </ul>
            {rest > 0 ? (
              <p className="mt-1.5 text-[11px] text-slate-500">
                …i jeszcze {rest}
              </p>
            ) : null}
            {overLimit ? (
              <p className="mt-1.5 text-[11px] font-medium text-amber-800">
                Limit {ZD_ESTIMATE_BULK_MAX} na jedną akcję — zapiszę pierwsze{" "}
                {ZD_ESTIMATE_BULK_MAX} z {lines.length}. Reszta zostanie
                zaznaczona; uruchom ponownie.
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-amber-200/70 bg-amber-50/45 px-3 py-2.5">
        <p className="text-xs font-semibold text-amber-950">
          Wspólna notatka dla wszystkich
        </p>
        <p className="mt-0.5 text-[11px] leading-snug text-amber-900/85">
          Jeśli produkt był już wykluczony, notatka zostanie nadpisana.
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
          placeholder="np. wycofane, zamienniki, nie zamawiamy…"
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
