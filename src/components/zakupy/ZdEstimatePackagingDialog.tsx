"use client";

import { useId, useState } from "react";
import type { ManualZdEstimateLine } from "@/lib/orders/zd-estimate-manual";
import { formatQty } from "@/lib/orders/zd-estimate-manual";
import {
  formatZdPackHint,
  resolveOrderQtyForLine,
} from "@/lib/orders/zd-estimate-packaging";
import type { ZdEstimatePackagingRow } from "@/lib/data/zd-estimate-packaging";
import { IconPackage } from "@/components/icons/StrokeIcons";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { ModalShell } from "@/components/ui/ModalShell";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/cn";
import { controlFocusClass, panelTypography } from "@/lib/ui/ontime-theme";

function PackagingDialogForm({
  line,
  existing,
  pending,
  individualExtraPieces = 0,
  onCancel,
  onSave,
  onClear,
}: {
  line: ManualZdEstimateLine;
  existing: ZdEstimatePackagingRow | null;
  pending?: boolean;
  individualExtraPieces?: number;
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
  const [units, setUnits] = useState(
    String(existing?.unitsPerPackage ?? 10)
  );
  const [label, setLabel] = useState(existing?.packageLabel ?? "op.");
  const [note, setNote] = useState(existing?.note ?? "");

  const unitsNum = Math.trunc(Number(units));
  const preview =
    Number.isFinite(unitsNum) && unitsNum >= 1
      ? resolveOrderQtyForLine(
          line,
          {
            unitsPerPackage: unitsNum,
            packageLabel: label.trim() || "op.",
          },
          individualExtraPieces
        )
      : null;

  const canSave = Number.isFinite(unitsNum) && unitsNum >= 1 && unitsNum <= 100_000;

  return (
    <ModalShell
      open
      onClose={onCancel}
      title="Opakowanie produktu"
      titleHint="Ustaw, ile sztuk przychodzi, gdy w ZD wpiszesz „1”. Program zapamięta to na kolejne szacunki."
      titleId="zd-estimate-packaging-title"
      size="md"
      tier="raised"
      disableBackdropClose={pending}
      bodyClassName="space-y-4 px-5 py-5 sm:px-6"
      loadingMessage={pending ? "Zapisuję…" : null}
      footer={
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          {existing ? (
            <Button
              type="button"
              variant="ghost"
              className="min-h-11 w-full sm:w-auto"
              disabled={pending}
              onClick={onClear}
            >
              Usuń (sztuki)
            </Button>
          ) : (
            <span />
          )}
          <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row">
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
                "Zapisz"
              )}
            </Button>
          </div>
        </div>
      }
    >
      <div className="rounded-lg border border-slate-200/90 bg-slate-50/70 px-3.5 py-3">
        <div className="flex gap-3">
          <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md bg-white text-slate-500 ring-1 ring-slate-200/80">
            <IconPackage size={18} strokeWidth={1.75} aria-hidden />
          </div>
          <div className="min-w-0 space-y-1">
            <p className="font-semibold tabular-nums tracking-tight text-slate-900">
              {line.tw_Symbol}
            </p>
            <p className="text-sm leading-snug text-slate-600">{line.tw_Nazwa}</p>
            <p className="text-[11px] tabular-nums text-slate-500">
              Potrzeba przy tym opakowaniu:{" "}
              <span className="font-semibold text-slate-800">
                {preview ? formatQty(preview.piecesNeeded) : "—"} szt
              </span>
              {individualExtraPieces > 0 ? (
                <span className="ml-1 font-semibold text-emerald-700">
                  (w tym +{formatQty(individualExtraPieces)} z próśb)
                </span>
              ) : null}
            </p>
          </div>
        </div>
      </div>

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
          <span className="text-xs font-medium text-slate-600">
            Etykieta
          </span>
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

      {preview && preview.hasPackaging && preview.piecesNeeded > 0 ? (
        <div className="rounded-lg border border-emerald-200/70 bg-emerald-50/50 px-3 py-2.5">
          <p className="text-xs font-semibold text-emerald-950">
            Na ZD wpisz: {preview.zdUnits}
          </p>
          <p className="mt-0.5 text-[11px] leading-snug text-emerald-900/85">
            {formatZdPackHint(preview)}
            {preview.roundedUp
              ? " — zaokrąglenie opakowania w górę (przyjdzie trochę więcej niż potrzeba)."
              : "."}
          </p>
        </div>
      ) : preview && !preview.hasPackaging ? (
        <div className="rounded-lg border border-slate-200/80 bg-slate-50/60 px-3 py-2.5">
          <p className="text-xs font-medium text-slate-700">
            Bez opakowania — w ZD wpisujesz sztuki 1:1.
          </p>
        </div>
      ) : null}

      <label htmlFor={noteId} className="block">
        <span className="text-xs font-medium text-slate-600">
          Notatka{" "}
          <span className="font-normal text-slate-400">(opcjonalnie)</span>
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

export function ZdEstimatePackagingDialog({
  open,
  line,
  existing,
  pending,
  individualExtraPieces = 0,
  onCancel,
  onSave,
  onClear,
}: {
  open: boolean;
  line: ManualZdEstimateLine | null;
  existing: ZdEstimatePackagingRow | null;
  pending?: boolean;
  individualExtraPieces?: number;
  onCancel: () => void;
  onSave: (input: {
    unitsPerPackage: number;
    packageLabel: string;
    note: string;
  }) => void;
  onClear: () => void;
}) {
  if (!open || !line) return null;
  return (
    <PackagingDialogForm
      key={`${line.tw_Id}-${existing?.unitsPerPackage ?? 0}-${existing?.updatedAt ?? ""}`}
      line={line}
      existing={existing}
      pending={pending}
      individualExtraPieces={individualExtraPieces}
      onCancel={onCancel}
      onSave={onSave}
      onClear={onClear}
    />
  );
}
