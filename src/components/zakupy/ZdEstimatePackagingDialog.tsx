"use client";

import { useId, useState } from "react";
import type { ManualZdEstimateLine } from "@/lib/orders/zd-estimate-manual";
import { formatQty } from "@/lib/orders/zd-estimate-manual";
import {
  assertPackagingUnits,
  formatZdPackHint,
  formatZdPackOrderPreviewLine,
  formatZdPackRoundupLine,
  isPackagingPackagesMode,
  resolveOrderQtyForLine,
  ZD_PACKAGING_UNITS_MAX,
  ZD_PACKAGING_UNITS_MIN,
  type ZdPackagingDocumentUnitMode,
} from "@/lib/orders/zd-estimate-packaging";
import type { ZdEstimateExtrasPolicy } from "@/lib/orders/zd-estimate-extras-policy";
import type { ZdEstimatePackagingRow } from "@/lib/data/zd-estimate-packaging";
import { IconPackage } from "@/components/icons/StrokeIcons";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { ModalShell } from "@/components/ui/ModalShell";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/cn";
import { ZD_ESTIMATE_UI } from "@/lib/orders/zd-estimate-ui-copy";
import { controlFocusClass, panelTypography } from "@/lib/ui/ontime-theme";
import { ZdPackagingLabelPresets } from "@/components/zakupy/ZdPackagingLabelPresets";

function PackagingDialogForm({
  line,
  existing,
  pending,
  individualExtraPieces = 0,
  extraOnly = false,
  extrasPolicy = "sum",
  onCancel,
  onSave,
  onClear,
}: {
  line: ManualZdEstimateLine;
  existing: ZdEstimatePackagingRow | null;
  pending?: boolean;
  individualExtraPieces?: number;
  /** „Tylko na prośbę” z aktywną prośbą — podgląd qty bez celu zapasu. */
  extraOnly?: boolean;
  extrasPolicy?: ZdEstimateExtrasPolicy;
  onCancel: () => void;
  onSave: (input: {
    unitsPerPackage: number;
    packageLabel: string;
    documentUnitMode: ZdPackagingDocumentUnitMode;
    note: string;
  }) => void;
  onClear: () => void;
}) {
  const unitsId = useId();
  const labelId = useId();
  const noteId = useId();
  const modePackagesId = useId();
  const modePiecesId = useId();
  const pairPackBlocksPiecesMode = line.pair?.role === "pack";
  const [units, setUnits] = useState(
    String(existing?.unitsPerPackage ?? 10)
  );
  const [label, setLabel] = useState(existing?.packageLabel ?? "op.");
  const [note, setNote] = useState(existing?.note ?? "");
  const [documentUnitMode, setDocumentUnitMode] =
    useState<ZdPackagingDocumentUnitMode>(() => {
      if (pairPackBlocksPiecesMode) return "packages";
      return existing?.documentUnitMode ?? "packages";
    });

  const effectiveMode: ZdPackagingDocumentUnitMode = pairPackBlocksPiecesMode
    ? "packages"
    : documentUnitMode;

  const unitsCheck = assertPackagingUnits(units);
  const unitsOk = unitsCheck.ok;
  const unitsNum = unitsOk ? unitsCheck.units : Math.trunc(Number(units));
  const showUnitsError = units.trim() !== "" && !unitsOk;
  const preview = unitsOk
    ? resolveOrderQtyForLine(
        line,
        {
          unitsPerPackage: unitsCheck.units,
          packageLabel: label.trim() || "op.",
          documentUnitMode: effectiveMode,
        },
        individualExtraPieces,
        extraOnly,
        extrasPolicy
      )
    : null;
  const roundup = preview ? formatZdPackRoundupLine(preview) : null;
  const packagesMode = isPackagingPackagesMode(effectiveMode);

  return (
    <ModalShell
      open
      onClose={onCancel}
      title={ZD_ESTIMATE_UI.packagingDialogTitle}
      titleHint={ZD_ESTIMATE_UI.packagingDialogHint}
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
              {ZD_ESTIMATE_UI.packagingClearCta}
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
              disabled={pending || !unitsOk}
              onClick={() => {
                if (!unitsCheck.ok) return;
                onSave({
                  unitsPerPackage: unitsCheck.units,
                  packageLabel: label.trim() || "op.",
                  documentUnitMode: effectiveMode,
                  note: note.trim(),
                });
              }}
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
            {extraOnly ? (
              <p className="text-[11px] font-semibold text-amber-800">
                Tylko prośba — bez celu zapasu
              </p>
            ) : individualExtraPieces > 0 ? (
              <p className="text-[11px] font-semibold text-emerald-700">
                {extrasPolicy === "max"
                  ? `Prośba ${formatQty(individualExtraPieces)} szt · maks. vs niedobór`
                  : `W tym +${formatQty(individualExtraPieces)} szt z próśb`}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-xs font-medium text-slate-600">
          Tryb dokumentu
        </legend>
        <label
          htmlFor={modePackagesId}
          className={cn(
            "flex cursor-pointer gap-2 rounded-lg border px-3 py-2.5",
            effectiveMode === "packages"
              ? "border-indigo-200 bg-indigo-50/60"
              : "border-slate-200 bg-white"
          )}
        >
          <input
            id={modePackagesId}
            type="radio"
            name="zd-pack-mode"
            className="mt-0.5"
            checked={effectiveMode === "packages"}
            disabled={pending}
            onChange={() => setDocumentUnitMode("packages")}
          />
          <span className="min-w-0">
            <span className="block text-xs font-semibold text-slate-900">
              {ZD_ESTIMATE_UI.packagingModePackagesLabel}
            </span>
            <span className="mt-0.5 block text-[11px] leading-snug text-slate-500">
              {ZD_ESTIMATE_UI.packagingModePackagesHint}
            </span>
          </span>
        </label>
        <label
          htmlFor={modePiecesId}
          className={cn(
            "flex gap-2 rounded-lg border px-3 py-2.5",
            pairPackBlocksPiecesMode
              ? "cursor-not-allowed border-slate-200 bg-slate-50 opacity-70"
              : "cursor-pointer",
            !pairPackBlocksPiecesMode && effectiveMode === "pieces_multiple"
              ? "border-indigo-200 bg-indigo-50/60"
              : !pairPackBlocksPiecesMode
                ? "border-slate-200 bg-white"
                : null
          )}
        >
          <input
            id={modePiecesId}
            type="radio"
            name="zd-pack-mode"
            className="mt-0.5"
            checked={effectiveMode === "pieces_multiple"}
            disabled={pending || pairPackBlocksPiecesMode}
            onChange={() => setDocumentUnitMode("pieces_multiple")}
          />
          <span className="min-w-0">
            <span className="block text-xs font-semibold text-slate-900">
              {ZD_ESTIMATE_UI.packagingModePiecesLabel}
            </span>
            <span className="mt-0.5 block text-[11px] leading-snug text-slate-500">
              {pairPackBlocksPiecesMode
                ? ZD_ESTIMATE_UI.packagingModePairBlockedHint
                : ZD_ESTIMATE_UI.packagingModePiecesHint}
            </span>
          </span>
        </label>
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-2">
        <label htmlFor={unitsId} className="block">
          <span className="text-xs font-medium text-slate-600">
            {ZD_ESTIMATE_UI.packagingUnitsLabel}
          </span>
          <Input
            id={unitsId}
            type="number"
            min={ZD_PACKAGING_UNITS_MIN}
            max={ZD_PACKAGING_UNITS_MAX}
            value={units}
            onChange={(e) => setUnits(e.target.value)}
            disabled={pending}
            className="mt-1.5"
            autoFocus
            aria-invalid={showUnitsError || undefined}
          />
          <p className={cn(panelTypography.caption, "mt-1")}>
            {ZD_ESTIMATE_UI.packagingUnitsHint}
          </p>
        </label>
        <div>
          <label htmlFor={labelId} className="block">
            <span className="text-xs font-medium text-slate-600">
              {ZD_ESTIMATE_UI.packagingLabelField}
            </span>
            <Input
              id={labelId}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              maxLength={24}
              disabled={pending}
              placeholder="op. / karton"
              className="mt-1.5"
            />
          </label>
          <ZdPackagingLabelPresets
            value={label}
            disabled={pending}
            onSelect={setLabel}
            className="mt-2"
          />
        </div>
      </div>

      {preview && preview.hasPackaging && preview.piecesNeeded > 0 ? (
        <div className="space-y-1.5 rounded-lg border border-emerald-200/70 bg-emerald-50/50 px-3 py-2.5">
          <p className="text-xs text-emerald-950">
            <span className="font-medium text-emerald-800/90">
              {ZD_ESTIMATE_UI.packagingNeedLabel}:{" "}
            </span>
            <span className="font-semibold tabular-nums">
              {formatQty(preview.piecesNeeded)} szt
            </span>
          </p>
          <p className="text-xs text-emerald-950">
            <span className="font-medium text-emerald-800/90">
              {ZD_ESTIMATE_UI.packagingOrderLabel}:{" "}
            </span>
            <span className="font-semibold tabular-nums">
              {formatZdPackOrderPreviewLine(preview)}
            </span>
          </p>
          <p className="text-[11px] leading-snug text-emerald-900/85">
            {formatZdPackHint(preview)}
          </p>
          {roundup ? (
            <p className="text-[11px] font-medium text-amber-800">{roundup}</p>
          ) : null}
        </div>
      ) : unitsOk ? (
        <div className="rounded-lg border border-slate-200/80 bg-slate-50/60 px-3 py-2.5">
          <p className="text-xs font-medium text-slate-700">
            {packagesMode
              ? `1 ${label.trim() || "op."} = ${unitsNum} szt — przy braku niedoboru Do ZD będzie 0.`
              : `Wielokrotność ${unitsNum} szt — przy braku niedoboru Do ZD będzie 0.`}
          </p>
        </div>
      ) : showUnitsError ? (
        <div className="rounded-lg border border-amber-200/80 bg-amber-50/60 px-3 py-2.5">
          <p className="text-xs font-medium text-amber-900">
            {unitsCheck.message}
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
  extraOnly = false,
  extrasPolicy = "sum",
  onCancel,
  onSave,
  onClear,
}: {
  open: boolean;
  line: ManualZdEstimateLine | null;
  existing: ZdEstimatePackagingRow | null;
  pending?: boolean;
  individualExtraPieces?: number;
  extraOnly?: boolean;
  extrasPolicy?: ZdEstimateExtrasPolicy;
  onCancel: () => void;
  onSave: (input: {
    unitsPerPackage: number;
    packageLabel: string;
    documentUnitMode: ZdPackagingDocumentUnitMode;
    note: string;
  }) => void;
  onClear: () => void;
}) {
  if (!open || !line) return null;
  return (
    <PackagingDialogForm
      key={`${line.tw_Id}-${existing?.unitsPerPackage ?? 0}-${existing?.documentUnitMode ?? "packages"}-${existing?.updatedAt ?? ""}-${extraOnly ? "eo" : "st"}-${extrasPolicy}`}
      line={line}
      existing={existing}
      pending={pending}
      individualExtraPieces={individualExtraPieces}
      extraOnly={extraOnly}
      extrasPolicy={extrasPolicy}
      onCancel={onCancel}
      onSave={onSave}
      onClear={onClear}
    />
  );
}
