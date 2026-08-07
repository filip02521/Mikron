"use client";

import { useId, useState } from "react";
import { IconPackage } from "@/components/icons/StrokeIcons";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { ModalShell } from "@/components/ui/ModalShell";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/cn";
import { controlFocusClass, panelTypography } from "@/lib/ui/ontime-theme";
import { ZD_ESTIMATE_BULK_MAX } from "@/lib/orders/zd-estimate-bulk";
import type { ZdEstimateBulkLinePreview } from "@/components/zakupy/ZdEstimateBulkExcludeDialog";

export function ZdEstimateBulkPackagingDialog({
  open,
  lines,
  pending,
  mode = "set",
  onCancel,
  onSave,
  onClear,
}: {
  open: boolean;
  lines: ZdEstimateBulkLinePreview[];
  pending?: boolean;
  /** set = ustaw opakowanie; clear = potwierdź usunięcie */
  mode?: "set" | "clear";
  onCancel: () => void;
  onSave: (input: {
    unitsPerPackage: number;
    packageLabel: string;
    note: string;
  }) => void;
  onClear: () => void;
}) {
  const unitsId = useId();
  const labelId = useId();
  const noteId = useId();
  const [units, setUnits] = useState("10");
  const [label, setLabel] = useState("op.");
  const [note, setNote] = useState("");

  if (!open || lines.length === 0) return null;

  const unitsNum = Math.trunc(Number(units));
  const canSave =
    Number.isFinite(unitsNum) && unitsNum >= 1 && unitsNum <= 100_000;
  const preview = lines.slice(0, 8);
  const rest = lines.length - preview.length;
  const overLimit = lines.length > ZD_ESTIMATE_BULK_MAX;
  const actionCount = Math.min(lines.length, ZD_ESTIMATE_BULK_MAX);

  if (mode === "clear") {
    const clearOverLimit = lines.length > ZD_ESTIMATE_BULK_MAX;
    const clearCount = Math.min(lines.length, ZD_ESTIMATE_BULK_MAX);
    return (
      <ModalShell
        open
        onClose={onCancel}
        title={`Usuń opakowanie (${clearCount}${clearOverLimit ? ` z ${lines.length}` : ""})`}
        titleHint="Zaznaczone wrócą do zamawiania na sztuki 1:1 w kolumnie Do ZD."
        titleId="zd-estimate-bulk-packaging-clear-title"
        size="md"
        tier="raised"
        disableBackdropClose={pending}
        bodyClassName="space-y-4 px-5 py-5 sm:px-6"
        loadingMessage={pending ? "Usuwam…" : null}
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
              onClick={onClear}
              disabled={pending}
            >
              {pending ? (
                <span className="inline-flex items-center gap-2">
                  <Spinner className="size-4" /> Usuwam…
                </span>
              ) : (
                `Usuń opakowanie (${clearCount})`
              )}
            </Button>
          </div>
        }
      >
        <BulkProductPreview lines={preview} rest={rest} />
        {clearOverLimit ? (
          <p className="text-[11px] font-medium text-amber-800">
            Limit {ZD_ESTIMATE_BULK_MAX} na jedną akcję — usunę pierwsze{" "}
            {ZD_ESTIMATE_BULK_MAX} z {lines.length}.
          </p>
        ) : null}
        <p className="text-sm leading-relaxed text-slate-600">
          Ustawienia opakowań zostaną usunięte. Stany i sprzedaż nadal liczymy w
          sztukach — w ZD wpiszesz sztuki 1:1.
        </p>
      </ModalShell>
    );
  }

  return (
    <ModalShell
      open
      onClose={onCancel}
      title={`Opakowanie dla ${actionCount}${overLimit ? ` z ${lines.length}` : ""}`}
      titleHint="Jedna wartość dla wszystkich zaznaczonych — ile sztuk = 1 na dokumencie ZD."
      titleId="zd-estimate-bulk-packaging-title"
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
            className="min-h-11 w-full sm:w-auto"
            disabled={pending || !canSave}
            onClick={() =>
              onSave({
                unitsPerPackage: unitsNum,
                packageLabel: label.trim() || "op.",
                note: note.trim(),
              })
            }
          >
            {pending ? (
              <span className="inline-flex items-center gap-2">
                <Spinner className="size-4" /> Zapisuję…
              </span>
            ) : (
              `Zapisz dla ${actionCount}`
            )}
          </Button>
        </div>
      }
    >
      <BulkProductPreview lines={preview} rest={rest} />

      {overLimit ? (
        <p className="text-[11px] font-medium text-amber-800">
          Limit {ZD_ESTIMATE_BULK_MAX} na jedną akcję — zapiszę pierwsze{" "}
          {ZD_ESTIMATE_BULK_MAX} z {lines.length}. Reszta zostanie zaznaczona.
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <label htmlFor={unitsId} className="block">
          <span className="text-xs font-medium text-slate-600">
            Sztuk w 1 na ZD
          </span>
          <Input
            id={unitsId}
            type="number"
            min={1}
            max={100000}
            value={units}
            onChange={(e) => setUnits(e.target.value)}
            disabled={pending}
            className="mt-1.5"
            autoFocus
          />
          <p className={cn(panelTypography.caption, "mt-1")}>
            1 = zamawiamy na sztuki (usuwa ustawienie)
          </p>
        </label>
        <label htmlFor={labelId} className="block">
          <span className="text-xs font-medium text-slate-600">Etykieta</span>
          <Input
            id={labelId}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            maxLength={24}
            disabled={pending}
            placeholder="op. / paczka"
            className="mt-1.5"
          />
        </label>
      </div>

      {canSave && unitsNum >= 2 ? (
        <div className="rounded-lg border border-emerald-200/70 bg-emerald-50/50 px-3 py-2.5">
          <p className="text-xs font-semibold text-emerald-950">
            Dla każdego: 1 {label.trim() || "op."} = {unitsNum} szt
          </p>
          <p className="mt-0.5 text-[11px] leading-snug text-emerald-900/85">
            Niedobór liczymy w sztukach, a „Do ZD” pokaże liczbę paczek (ceil).
          </p>
        </div>
      ) : canSave && unitsNum === 1 ? (
        <div className="rounded-lg border border-slate-200/80 bg-slate-50/60 px-3 py-2.5">
          <p className="text-xs font-medium text-slate-700">
            Wartość 1 usunie opakowanie — zaznaczone wrócą do sztuk 1:1.
          </p>
        </div>
      ) : null}

      <label htmlFor={noteId} className="block">
        <span className="text-xs font-medium text-slate-600">
          Notatka{" "}
          <span className="font-normal text-slate-400">
            (opcjonalnie — pusta nie zmienia istniejących)
          </span>
        </span>
        <textarea
          id={noteId}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          maxLength={500}
          disabled={pending}
          placeholder="np. Falcon — karton 10 szt"
          className={cn(
            "mt-1.5 w-full resize-y rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400",
            controlFocusClass
          )}
        />
      </label>
    </ModalShell>
  );
}

function BulkProductPreview({
  lines,
  rest,
}: {
  lines: ZdEstimateBulkLinePreview[];
  rest: number;
}) {
  return (
    <div className="rounded-xl border border-slate-200/90 bg-slate-50/70 px-3.5 py-3">
      <div className="flex gap-3">
        <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md bg-white text-slate-500 ring-1 ring-slate-200/80">
          <IconPackage size={18} strokeWidth={1.75} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-slate-900">
            Zaznaczone produkty
          </p>
          <ul className="mt-1.5 space-y-1">
            {lines.map((l) => (
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
        </div>
      </div>
    </div>
  );
}
