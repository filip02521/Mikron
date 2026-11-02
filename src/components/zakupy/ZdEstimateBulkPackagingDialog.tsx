"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { ModalShell } from "@/components/ui/ModalShell";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Spinner } from "@/components/ui/Spinner";
import { ZdPackagingLabelPresets } from "@/components/zakupy/ZdPackagingLabelPresets";
import { cn } from "@/lib/cn";
import { controlFocusClass, panelTypography } from "@/lib/ui/ontime-theme";
import { ZD_ESTIMATE_BULK_MAX } from "@/lib/orders/zd-estimate-bulk";
import {
  assertPackagingUnits,
  parsePalletInput,
  ZD_PACKAGING_UNITS_MAX,
  ZD_PACKAGING_UNITS_MIN,
  type ZdPackagingDocumentUnitMode,
} from "@/lib/orders/zd-estimate-packaging";
import { ZD_ESTIMATE_UI } from "@/lib/orders/zd-estimate-ui-copy";
import { polishPluralWord } from "@/lib/email/polish-plural";
import type { ZdEstimateBulkLinePreview } from "@/components/zakupy/ZdEstimateBulkExcludeDialog";

type PalletChoice = "keep" | "set" | "off";

export function ZdEstimateBulkPackagingDialog({
  open,
  lines,
  pending,
  mode = "set",
  packPairTwIds,
  onCancel,
  onSave,
  onClear,
}: {
  open: boolean;
  lines: ZdEstimateBulkLinePreview[];
  pending?: boolean;
  /** set = ustaw opakowanie; clear = potwierdź usunięcie */
  mode?: "set" | "clear";
  /** tw_Id opakowań z pary — N z pary, tylko tryb opakowań. */
  packPairTwIds?: ReadonlySet<number> | null;
  onCancel: () => void;
  onSave: (input: {
    /** Brak = N z pary (same opakowania z pary). */
    unitsPerPackage?: number;
    /** Brak = bez zmian. */
    packageLabel?: string;
    documentUnitMode: ZdPackagingDocumentUnitMode;
    /** Brak = bez zmian, null = wyłącz palety. */
    orderMultiple?: number | null;
    note: string;
  }) => void;
  onClear: () => void;
}) {
  const unitsId = useId();
  const palletId = useId();
  const labelId = useId();
  const noteId = useId();
  const modePackagesId = useId();
  const modePiecesId = useId();
  const [units, setUnits] = useState("10");
  const [palletChoice, setPalletChoice] = useState<PalletChoice>("keep");
  const [pallet, setPallet] = useState("");
  const [label, setLabel] = useState("");
  const [note, setNote] = useState("");
  const [documentUnitMode, setDocumentUnitMode] =
    useState<ZdPackagingDocumentUnitMode>("packages");

  if (!open || lines.length === 0) return null;

  const pairCount = lines.filter((l) => packPairTwIds?.has(l.tw_Id)).length;
  const anyPair = pairCount > 0;
  const allPair = pairCount === lines.length;
  const effectiveMode: ZdPackagingDocumentUnitMode = anyPair
    ? "packages"
    : documentUnitMode;
  const packagesMode = effectiveMode === "packages";

  // Same opakowania z pary: N pochodzi z pary (serwer), pole sztuk nie ma znaczenia.
  const unitsCheck = allPair
    ? ({ ok: true, units: undefined } as const)
    : assertPackagingUnits(units);
  const showUnitsError = !allPair && units.trim() !== "" && !unitsCheck.ok;
  // „Ustaw” wymaga liczby; „Bez zmian” = undefined, „Wyłącz” albo tryb sztuk = null.
  const palletSet = packagesMode && palletChoice === "set";
  const palletParsed = parsePalletInput(palletSet ? pallet : "");
  const palletError = !palletSet
    ? null
    : !palletParsed.ok
      ? palletParsed.message
      : palletParsed.value == null
        ? ZD_ESTIMATE_UI.packagingOrderMultipleRequiredError
        : null;
  const palletOk = palletError == null;
  let resolvedPallet: number | null | undefined;
  if (!packagesMode || palletChoice === "off") resolvedPallet = null;
  else if (palletChoice === "keep") resolvedPallet = undefined;
  else resolvedPallet = palletParsed.ok ? palletParsed.value : null;
  const canSave = unitsCheck.ok && palletOk;
  const preview = lines.slice(0, 8);
  const rest = lines.length - preview.length;
  const overLimit = lines.length > ZD_ESTIMATE_BULK_MAX;
  const actionCount = Math.min(lines.length, ZD_ESTIMATE_BULK_MAX);
  const labelTrim = label.trim();

  let unitsLine: string;
  if (allPair) unitsLine = "Opakowanie: N z pary (bez zmian)";
  else if (!packagesMode) {
    unitsLine = `Na ZD sztuki, zaokrąglone do ${unitsCheck.ok ? unitsCheck.units : "?"} szt`;
  } else {
    unitsLine = `Opakowanie: ${unitsCheck.ok ? unitsCheck.units : "?"} szt w 1`;
    if (anyPair) {
      unitsLine += ` (${pairCount} z pary ${polishPluralWord(pairCount, "zachowa", "zachowają", "zachowa")} N z pary)`;
    }
  }
  const palletLine = !packagesMode
    ? "Palety: wyłączone (tryb sztuk)"
    : resolvedPallet === undefined
      ? "Palety: bez zmian"
      : resolvedPallet === null
        ? palletChoice === "set"
          ? "Palety: ?"
          : "Palety: wyłączone"
        : `Palety: co ${resolvedPallet} ${polishPluralWord(resolvedPallet, "opakowanie", "opakowania", "opakowań")}`;
  const summary = [unitsLine, `Etykieta: ${labelTrim ? labelTrim : "bez zmian"}`, palletLine];

  if (mode === "clear") {
    const clearOverLimit = lines.length > ZD_ESTIMATE_BULK_MAX;
    const clearCount = Math.min(lines.length, ZD_ESTIMATE_BULK_MAX);
    return (
      <ModalShell
        open
        onClose={onCancel}
        title={`Usuń opakowanie (${clearCount}${clearOverLimit ? ` z ${lines.length}` : ""})`}
        titleHint={ZD_ESTIMATE_UI.packagingBulkClearHint}
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
          <p className="text-xs font-medium text-amber-800">
            Limit {ZD_ESTIMATE_BULK_MAX} na jedną akcję - usunę pierwsze{" "}
            {ZD_ESTIMATE_BULK_MAX} z {lines.length}.
          </p>
        ) : null}
        <p className="text-sm leading-relaxed text-slate-600">
          Ustawienia opakowań zostaną usunięte. Stany i sprzedaż nadal liczymy w
          sztukach - w ZD wpiszesz sztuki 1:1.
        </p>
      </ModalShell>
    );
  }

  return (
    <ModalShell
      open
      onClose={onCancel}
      title={`Opakowanie dla ${actionCount}${overLimit ? ` z ${lines.length}` : ""}`}
      titleHint={ZD_ESTIMATE_UI.packagingBulkDialogHint}
      titleId="zd-estimate-bulk-packaging-title"
      size="md"
      tier="raised"
      disableBackdropClose={pending}
      bodyClassName="space-y-5 px-5 py-5 sm:px-6"
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
            onClick={() => {
              if (!unitsCheck.ok || !palletOk) return;
              onSave({
                unitsPerPackage: unitsCheck.units,
                packageLabel: labelTrim || undefined,
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
              `Zapisz dla ${actionCount}`
            )}
          </Button>
        </div>
      }
    >
      <BulkProductPreview lines={preview} rest={rest} />

      {overLimit ? (
        <p className="text-xs font-medium text-amber-800">
          Limit {ZD_ESTIMATE_BULK_MAX} na jedną akcję - zapiszę pierwsze{" "}
          {ZD_ESTIMATE_BULK_MAX} z {lines.length}. Reszta zostanie zaznaczona.
        </p>
      ) : null}

      {allPair ? (
        <p className={cn(panelTypography.caption)}>
          {ZD_ESTIMATE_UI.packagingBulkAllPairHint}
        </p>
      ) : (
        <>
          <fieldset className="space-y-2">
            <legend className="text-xs font-medium text-slate-600">
              Na dokumencie ZD
            </legend>
            {(
              [
                { id: modePackagesId, mode: "packages" as const, title: ZD_ESTIMATE_UI.packagingModePackagesLabel },
                { id: modePiecesId, mode: "pieces_multiple" as const, title: ZD_ESTIMATE_UI.packagingModePiecesLabel },
              ]
            ).map((opt) => {
              const blocked = opt.mode === "pieces_multiple" && anyPair;
              return (
                <label
                  key={opt.mode}
                  htmlFor={opt.id}
                  className={cn(
                    "flex gap-2.5 rounded-md border px-3 py-2.5",
                    blocked
                      ? "cursor-not-allowed border-slate-200 bg-slate-50"
                      : effectiveMode === opt.mode
                        ? "cursor-pointer border-indigo-300 bg-indigo-50/60"
                        : "cursor-pointer border-slate-200 bg-card hover:bg-slate-50"
                  )}
                >
                  <input
                    id={opt.id}
                    type="radio"
                    name="zd-bulk-pack-mode"
                    className="mt-0.5"
                    checked={effectiveMode === opt.mode}
                    disabled={pending || blocked}
                    onChange={() => setDocumentUnitMode(opt.mode)}
                  />
                  <span className="min-w-0">
                    <span className={cn("block text-sm font-medium", blocked ? "text-slate-600" : "text-slate-900")}>
                      {opt.title}
                    </span>
                    {blocked ? (
                      <span className="mt-0.5 block text-xs leading-snug text-slate-600">
                        {ZD_ESTIMATE_UI.packagingModeBulkPairBlockedHint}
                      </span>
                    ) : null}
                  </span>
                </label>
              );
            })}
          </fieldset>

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
              className="mt-1.5 sm:max-w-[12rem]"
              data-autofocus
              aria-invalid={showUnitsError || undefined}
            />
            <p className={cn(panelTypography.caption, "mt-1", showUnitsError && "font-medium text-amber-900")}>
              {showUnitsError && !unitsCheck.ok
                ? unitsCheck.message
                : anyPair
                  ? ZD_ESTIMATE_UI.packagingBulkPairUnitsHint
                  : ZD_ESTIMATE_UI.packagingBulkUnitsHint}
            </p>
          </div>
        </>
      )}

      <div>
        <label htmlFor={labelId} className="block text-xs font-medium text-slate-600">
          {ZD_ESTIMATE_UI.packagingLabelField}{" "}
          <span className="font-normal text-slate-500">(puste = bez zmian)</span>
        </label>
        <Input
          id={labelId}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          maxLength={24}
          disabled={pending}
          placeholder="bez zmian"
          className="mt-1.5 sm:max-w-[16rem]"
        />
        <ZdPackagingLabelPresets
          value={label}
          disabled={pending}
          onSelect={setLabel}
          className="mt-2"
        />
      </div>

      {packagesMode ? (
        <div>
          <p className="text-xs font-medium text-slate-600" id={`${palletId}-legend`}>
            {ZD_ESTIMATE_UI.packagingOrderMultipleEnableLabel}
          </p>
          <SegmentedControl
            className="mt-1.5"
            value={palletChoice}
            onChange={setPalletChoice}
            ariaLabel={ZD_ESTIMATE_UI.packagingOrderMultipleEnableLabel}
            disabled={pending}
            options={[
              { value: "keep", label: "Bez zmian" },
              { value: "set", label: "Ustaw" },
              { value: "off", label: "Wyłącz" },
            ]}
          />
          {palletChoice === "set" ? (
            <div className="mt-2">
              <label htmlFor={palletId} className="block text-xs font-medium text-slate-600">
                {ZD_ESTIMATE_UI.packagingPalletFieldLabel}
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
                aria-invalid={palletError ? true : undefined}
              />
              <p className={cn(panelTypography.caption, "mt-1", palletError && "font-medium text-amber-900")}>
                {palletError ?? ZD_ESTIMATE_UI.packagingBulkPalletSameHint}
              </p>
            </div>
          ) : (
            <p className={cn(panelTypography.caption, "mt-1")}>
              {palletChoice === "keep"
                ? ZD_ESTIMATE_UI.packagingBulkPalletKeepHint
                : ZD_ESTIMATE_UI.packagingOrderMultipleOffCaption}
            </p>
          )}
        </div>
      ) : null}

      <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5" aria-live="polite">
        <p className="text-xs font-semibold text-slate-900">Zapiszę dla każdego zaznaczonego:</p>
        <ul className="mt-1 space-y-0.5 text-xs tabular-nums text-slate-700">
          {summary.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </div>

      <div>
        <label htmlFor={noteId} className="block text-xs font-medium text-slate-600">
          Notatka{" "}
          <span className="font-normal text-slate-500">(puste = bez zmian)</span>
        </label>
        <textarea
          id={noteId}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          maxLength={500}
          disabled={pending}
          placeholder="np. paleta 36 worków"
          className={cn(
            "mt-1.5 w-full resize-y rounded-md border border-slate-200 bg-card px-3 py-2 text-sm text-slate-800 placeholder:text-slate-500",
            controlFocusClass
          )}
        />
      </div>
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
    <div>
      <p className="text-xs font-medium text-slate-600">Zaznaczone produkty</p>
      <ul className="mt-1.5 space-y-1">
        {lines.map((l) => (
          <li key={l.tw_Id} className="flex min-w-0 items-baseline gap-2 text-sm">
            <span className="shrink-0 font-mono text-xs font-semibold tabular-nums text-slate-900">
              {l.tw_Symbol}
            </span>
            <span className="min-w-0 truncate text-slate-600" title={l.tw_Nazwa}>
              {l.tw_Nazwa}
            </span>
          </li>
        ))}
      </ul>
      {rest > 0 ? (
        <p className="mt-1.5 text-xs text-slate-600">…i jeszcze {rest}</p>
      ) : null}
    </div>
  );
}
