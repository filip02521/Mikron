"use client";

import { useId, useState } from "react";
import type { ManualZdEstimateLine } from "@/lib/orders/zd-estimate-manual";
import { formatQty } from "@/lib/orders/zd-estimate-manual";
import {
  assertPackagingUnits,
  formatZdPackDialogPreview,
  isPackagingPackagesMode,
  parsePalletInput,
  resolveOrderQtyForLine,
  ZD_PACKAGING_UNITS_MAX,
  ZD_PACKAGING_UNITS_MIN,
  type ZdPackagingDocumentUnitMode,
} from "@/lib/orders/zd-estimate-packaging";
import type { ZdEstimateExtrasPolicy } from "@/lib/orders/zd-estimate-extras-policy";
import type { ZdEstimatePackagingRow } from "@/lib/data/zd-estimate-packaging";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { ModalShell } from "@/components/ui/ModalShell";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/cn";
import { ZD_ESTIMATE_UI } from "@/lib/orders/zd-estimate-ui-copy";
import { controlFocusClass, panelTypography } from "@/lib/ui/ontime-theme";
import { ZdPackagingLabelPresets } from "@/components/zakupy/ZdPackagingLabelPresets";
import { collectZdPackagingPairConflicts } from "@/lib/orders/zd-estimate-packaging-pair-conflict";

function PackagingDialogForm({
  line,
  existing,
  pending,
  individualExtraPieces = 0,
  extraOnly = false,
  extrasPolicy = "sum",
  stockNeedReliefPieces = 0,
  extraOverlapPieces = 0,
  minStockSzt,
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
  stockNeedReliefPieces?: number;
  extraOverlapPieces?: number;
  /** Minimum stanów (szt) — ten sam podgląd co tabela i Utwórz ZD. */
  minStockSzt?: number;
  onCancel: () => void;
  onSave: (input: {
    unitsPerPackage: number;
    packageLabel: string;
    documentUnitMode: ZdPackagingDocumentUnitMode;
    orderMultiple: number | null;
    note: string;
  }) => void;
  onClear: () => void;
}) {
  const unitsId = useId();
  const unitsHintId = useId();
  const palletId = useId();
  const palletHintId = useId();
  const labelId = useId();
  const noteId = useId();
  const modePackagesId = useId();
  const modePiecesId = useId();
  // Opakowanie z pary: N zawsze z pary (serwer też je wymusza), tryb tylko opakowania.
  const pairUnits = line.pair?.role === "pack" ? line.pair.unitsPerPack : null;
  const isPairPack = pairUnits != null;
  const [units, setUnits] = useState(
    String(pairUnits ?? existing?.unitsPerPackage ?? 10)
  );
  const [pallet, setPallet] = useState(
    existing?.orderMultiple != null && existing.orderMultiple >= 2
      ? String(existing.orderMultiple)
      : ""
  );
  const [label, setLabel] = useState(existing?.packageLabel ?? "op.");
  const [note, setNote] = useState(existing?.note ?? "");
  const [documentUnitMode, setDocumentUnitMode] =
    useState<ZdPackagingDocumentUnitMode>(() =>
      isPairPack ? "packages" : (existing?.documentUnitMode ?? "packages")
    );

  const effectiveMode: ZdPackagingDocumentUnitMode = isPairPack
    ? "packages"
    : documentUnitMode;
  const packagesMode = isPackagingPackagesMode(effectiveMode);
  const labelText = label.trim() || "op.";

  const unitsCheck = assertPackagingUnits(units);
  const unitsOk = unitsCheck.ok;
  const showUnitsError = units.trim() !== "" && !unitsOk;

  // Puste pole palet = bez palet (bez osobnego przełącznika); tryb sztuk — palet brak.
  const palletParsed = parsePalletInput(packagesMode ? pallet : "");
  const palletOk = palletParsed.ok;
  const palletError = palletParsed.ok ? null : palletParsed.message;
  const resolvedPallet = palletParsed.ok ? palletParsed.value : null;

  // Stary zapis z pary (ta sama reguła co baner kreatora): N ≠ N pary — zwykle ktoś
  // wpisał paletę jako opakowanie; albo tryb sztuk — zapis przestawi na opakowania.
  const pairConflict = existing
    ? (collectZdPackagingPairConflicts(
        [line],
        new Map([[line.tw_Id, existing]])
      )[0] ?? null)
    : null;
  const pairConflictUnits =
    pairConflict?.reason === "units_mismatch" ? pairConflict.packagingUnits : null;
  const pairPiecesModeConflict = pairConflict?.reason === "pieces_multiple_mode";

  // Otwarte ZD są w jednostkach dokumentu — zmiana N/trybu przelicza je na nowo.
  const openZd = Math.max(0, Number(line.otwarteZd) || 0);
  const openZdChanges =
    !isPairPack &&
    openZd > 0 &&
    existing != null &&
    unitsOk &&
    (unitsCheck.units !== existing.unitsPerPackage ||
      effectiveMode !== existing.documentUnitMode);

  const preview = unitsOk
    ? resolveOrderQtyForLine(
        line,
        {
          unitsPerPackage: unitsCheck.units,
          packageLabel: labelText,
          documentUnitMode: effectiveMode,
          orderMultiple: resolvedPallet,
        },
        individualExtraPieces,
        extraOnly,
        extrasPolicy,
        stockNeedReliefPieces,
        extraOverlapPieces,
        minStockSzt
      )
    : null;
  const previewText =
    preview && preview.piecesNeeded > 0 ? formatZdPackDialogPreview(preview) : null;
  const canSave = unitsOk && palletOk;

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
      bodyClassName="space-y-5 px-5 py-5 sm:px-6"
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
              disabled={pending || !canSave}
              onClick={() => {
                if (!unitsCheck.ok || !palletOk) return;
                onSave({
                  unitsPerPackage: unitsCheck.units,
                  packageLabel: labelText,
                  documentUnitMode: effectiveMode,
                  orderMultiple: resolvedPallet,
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
      <div className="min-w-0">
        <p className="font-mono text-xs font-semibold tabular-nums text-slate-900">
          {line.tw_Symbol}
        </p>
        <p className="text-sm leading-snug text-slate-600">{line.tw_Nazwa}</p>
        {extraOnly ? (
          <p className="mt-1 text-xs font-semibold text-amber-800">
            Tylko prośba - bez celu zapasu
          </p>
        ) : individualExtraPieces > 0 ? (
          <p className="mt-1 text-xs font-medium text-slate-700">
            {extrasPolicy === "max"
              ? `Prośba ${formatQty(individualExtraPieces)} szt · maks. vs niedobór`
              : `W tym +${formatQty(individualExtraPieces)} szt z próśb`}
          </p>
        ) : null}
      </div>

      {pairConflictUnits != null ? (
        <div
          role="status"
          className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900"
        >
          <p className="leading-snug">
            {ZD_ESTIMATE_UI.packagingPairConflictCallout(
              pairConflictUnits,
              existing?.packageLabel?.trim() || "op.",
              pairUnits ?? 0
            )}
          </p>
          {pallet.trim() !== String(pairConflictUnits) ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="mt-2"
              disabled={pending}
              onClick={() => {
                setPallet(String(pairConflictUnits));
                // „paleta” jako etykieta opakowania z pary to ten sam stary błąd.
                if (/^pal/i.test(label.trim())) setLabel("op.");
              }}
            >
              {ZD_ESTIMATE_UI.packagingPairConflictCta(pairConflictUnits)}
            </Button>
          ) : null}
        </div>
      ) : null}

      {pairPiecesModeConflict && pairConflictUnits == null ? (
        <p
          role="status"
          className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-snug text-amber-900"
        >
          {ZD_ESTIMATE_UI.packagingPairPiecesModeNote}
        </p>
      ) : null}

      {isPairPack ? (
        <div>
          <p className="text-xs font-medium text-slate-600">
            {ZD_ESTIMATE_UI.packagingPairUnitsTitle}
          </p>
          <p className="mt-1 text-sm font-semibold tabular-nums text-slate-900">
            {ZD_ESTIMATE_UI.packagingPairUnitsLine(pairUnits, labelText)}
          </p>
          <p className={cn(panelTypography.caption, "mt-0.5")}>
            {ZD_ESTIMATE_UI.packagingUnitsFromPairHint}
          </p>
        </div>
      ) : (
        <fieldset className="space-y-2">
          <legend className="text-xs font-medium text-slate-600">
            Na dokumencie ZD
          </legend>
          {(
            [
              {
                id: modePackagesId,
                mode: "packages" as const,
                title: ZD_ESTIMATE_UI.packagingModePackagesLabel,
                hint: ZD_ESTIMATE_UI.packagingModePackagesHint,
              },
              {
                id: modePiecesId,
                mode: "pieces_multiple" as const,
                title: ZD_ESTIMATE_UI.packagingModePiecesLabel,
                hint: ZD_ESTIMATE_UI.packagingModePiecesHint,
              },
            ]
          ).map((opt) => (
            <label
              key={opt.mode}
              htmlFor={opt.id}
              className={cn(
                "flex cursor-pointer gap-2.5 rounded-md border px-3 py-2.5",
                effectiveMode === opt.mode
                  ? "border-indigo-300 bg-indigo-50/60"
                  : "border-slate-200 bg-white hover:bg-slate-50"
              )}
            >
              <input
                id={opt.id}
                type="radio"
                name="zd-pack-mode"
                className="mt-0.5"
                checked={effectiveMode === opt.mode}
                disabled={pending}
                onChange={() => setDocumentUnitMode(opt.mode)}
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-slate-900">
                  {opt.title}
                </span>
                <span className="mt-0.5 block text-xs leading-snug text-slate-600">
                  {opt.hint}
                </span>
              </span>
            </label>
          ))}
        </fieldset>
      )}

      <div
        className={cn(
          "grid gap-3",
          isPairPack ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2"
        )}
      >
        {isPairPack ? null : (
          <div>
            <label htmlFor={unitsId} className="block text-xs font-medium text-slate-600">
              {ZD_ESTIMATE_UI.packagingUnitsLabel}
            </label>
            <Input
              id={unitsId}
              type="number"
              inputMode="numeric"
              min={ZD_PACKAGING_UNITS_MIN}
              max={ZD_PACKAGING_UNITS_MAX}
              value={units}
              onChange={(e) => setUnits(e.target.value)}
              disabled={pending}
              state={showUnitsError ? "warning" : "default"}
              className="mt-1.5"
              data-autofocus
              aria-invalid={showUnitsError || undefined}
              aria-describedby={unitsHintId}
            />
            <p
              id={unitsHintId}
              className={cn(
                panelTypography.caption,
                "mt-1",
                showUnitsError && "font-medium text-amber-900"
              )}
            >
              {showUnitsError && !unitsCheck.ok
                ? unitsCheck.message
                : ZD_ESTIMATE_UI.packagingUnitsHint}
            </p>
          </div>
        )}
        <div>
          <label htmlFor={labelId} className="block text-xs font-medium text-slate-600">
            {ZD_ESTIMATE_UI.packagingLabelField}
          </label>
          <Input
            id={labelId}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            maxLength={24}
            disabled={pending}
            placeholder="op. / karton / worek"
            className="mt-1.5"
          />
          <ZdPackagingLabelPresets
            value={label}
            disabled={pending}
            onSelect={setLabel}
            className="mt-2"
          />
        </div>
      </div>

      {packagesMode ? (
        <div>
          <label htmlFor={palletId} className="block text-xs font-medium text-slate-600">
            {ZD_ESTIMATE_UI.packagingPalletFieldLabel}{" "}
            <span className="font-normal text-slate-500">
              {ZD_ESTIMATE_UI.packagingPalletFieldOptional}
            </span>
          </label>
          <Input
            id={palletId}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            state={palletError ? "warning" : "default"}
            value={pallet}
            onChange={(e) => setPallet(e.target.value)}
            disabled={pending}
            placeholder={ZD_ESTIMATE_UI.packagingOrderMultiplePlaceholder}
            className="mt-1.5 sm:max-w-[12rem]"
            data-autofocus={isPairPack || undefined}
            aria-invalid={palletError ? true : undefined}
            aria-describedby={palletHintId}
          />
          <p
            id={palletHintId}
            className={cn(
              panelTypography.caption,
              "mt-1",
              palletError && "font-medium text-amber-900"
            )}
          >
            {palletError ?? ZD_ESTIMATE_UI.packagingPalletFieldHint}
          </p>
        </div>
      ) : (
        <p className={cn(panelTypography.caption)}>
          {ZD_ESTIMATE_UI.packagingOrderMultipleModeHint}
        </p>
      )}

      {openZdChanges ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-snug text-amber-900">
          {ZD_ESTIMATE_UI.packagingOpenZdWarn(
            existing && isPackagingPackagesMode(existing.documentUnitMode)
              ? `${formatQty(openZd)} × ${existing.packageLabel.trim() || "op."}`
              : `${formatQty(openZd)} szt`
          )}
        </p>
      ) : null}

      {unitsOk ? (
        <div
          className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5"
          aria-live="polite"
        >
          {previewText ? (
            <>
              <p className="text-sm font-semibold tabular-nums text-slate-900">
                {previewText.orderLine}
              </p>
              <p className="mt-0.5 text-xs tabular-nums text-slate-600">
                {previewText.needLine}
              </p>
            </>
          ) : (
            <p className="text-xs text-slate-600">
              {ZD_ESTIMATE_UI.packagingNeedZeroLine}
            </p>
          )}
        </div>
      ) : null}

      <div>
        <label htmlFor={noteId} className="block text-xs font-medium text-slate-600">
          Notatka{" "}
          <span className="font-normal text-slate-500">(opcjonalnie)</span>
        </label>
        <textarea
          id={noteId}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          maxLength={500}
          disabled={pending}
          placeholder="np. paleta 36 worków, dostawa raz w miesiącu"
          className={cn(
            "mt-1.5 w-full resize-y rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-500",
            controlFocusClass
          )}
        />
      </div>
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
  stockNeedReliefPieces = 0,
  extraOverlapPieces = 0,
  minStockSzt,
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
  stockNeedReliefPieces?: number;
  extraOverlapPieces?: number;
  /** Minimum stanów (szt) — ten sam podgląd co tabela i Utwórz ZD. */
  minStockSzt?: number;
  onCancel: () => void;
  onSave: (input: {
    unitsPerPackage: number;
    packageLabel: string;
    documentUnitMode: ZdPackagingDocumentUnitMode;
    orderMultiple: number | null;
    note: string;
  }) => void;
  onClear: () => void;
}) {
  if (!open || !line) return null;
  return (
    <PackagingDialogForm
      key={`${line.tw_Id}-${existing?.unitsPerPackage ?? 0}-${existing?.orderMultiple ?? ""}-${existing?.documentUnitMode ?? "packages"}-${existing?.updatedAt ?? ""}-${extraOnly ? "eo" : "st"}-${extrasPolicy}-${stockNeedReliefPieces}-${extraOverlapPieces}-${minStockSzt ?? ""}`}
      line={line}
      existing={existing}
      pending={pending}
      individualExtraPieces={individualExtraPieces}
      extraOnly={extraOnly}
      extrasPolicy={extrasPolicy}
      stockNeedReliefPieces={stockNeedReliefPieces}
      extraOverlapPieces={extraOverlapPieces}
      minStockSzt={minStockSzt}
      onCancel={onCancel}
      onSave={onSave}
      onClear={onClear}
    />
  );
}
