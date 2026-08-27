"use client";

import { useId, useState } from "react";
import { IconPackage } from "@/components/icons/StrokeIcons";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { ModalShell } from "@/components/ui/ModalShell";
import { Spinner } from "@/components/ui/Spinner";
import { ZdPackagingLabelPresets } from "@/components/zakupy/ZdPackagingLabelPresets";
import { cn } from "@/lib/cn";
import { controlFocusClass, panelTypography } from "@/lib/ui/ontime-theme";
import { ZD_ESTIMATE_BULK_MAX } from "@/lib/orders/zd-estimate-bulk";
import {
  assertOrderMultiple,
  assertPackagingUnits,
  ZD_PACKAGING_UNITS_MAX,
  ZD_PACKAGING_UNITS_MIN,
  type ZdPackagingDocumentUnitMode,
} from "@/lib/orders/zd-estimate-packaging";
import { ZD_ESTIMATE_UI } from "@/lib/orders/zd-estimate-ui-copy";
import type { ZdEstimateBulkLinePreview } from "@/components/zakupy/ZdEstimateBulkExcludeDialog";

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
  /** tw_Id paczek z pary — Mode B zablokowany gdy zaznaczenie je zawiera. */
  packPairTwIds?: ReadonlySet<number> | null;
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
  const orderEnableId = useId();
  const orderMultId = useId();
  const labelId = useId();
  const noteId = useId();
  const modePackagesId = useId();
  const modePiecesId = useId();
  const [units, setUnits] = useState("10");
  const [orderMultipleEnabled, setOrderMultipleEnabled] = useState(false);
  const [orderMultiple, setOrderMultiple] = useState("");
  const [label, setLabel] = useState("op.");
  const [note, setNote] = useState("");
  const [documentUnitMode, setDocumentUnitMode] =
    useState<ZdPackagingDocumentUnitMode>("packages");

  if (!open || lines.length === 0) return null;

  const pairPackBlocksPiecesMode = lines.some((l) =>
    packPairTwIds?.has(l.tw_Id)
  );
  const effectiveMode: ZdPackagingDocumentUnitMode = pairPackBlocksPiecesMode
    ? "packages"
    : documentUnitMode;
  const packagesMode = effectiveMode === "packages";
  const orderActive = packagesMode && orderMultipleEnabled;

  const unitsCheck = assertPackagingUnits(units);
  const orderCheck = assertOrderMultiple(orderActive ? orderMultiple : null);
  const orderValueOk =
    !orderActive ||
    (orderCheck.ok && orderCheck.orderMultiple != null);
  const canSave = unitsCheck.ok && orderValueOk;
  const unitsNum = unitsCheck.ok
    ? unitsCheck.units
    : Math.trunc(Number(units));
  const showUnitsError = units.trim() !== "" && !unitsCheck.ok;
  const showOrderError =
    orderActive &&
    (orderMultiple.trim() === "" || !orderCheck.ok || !orderValueOk);
  const orderErrorMessage =
    orderActive && orderMultiple.trim() === ""
      ? ZD_ESTIMATE_UI.packagingOrderMultipleRequiredError
      : !orderCheck.ok
        ? orderCheck.message
        : orderActive && orderCheck.orderMultiple == null
          ? ZD_ESTIMATE_UI.packagingOrderMultipleRequiredError
          : null;
  const resolvedOrderMultiple =
    orderActive && orderCheck.ok ? orderCheck.orderMultiple : null;
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
      titleHint={ZD_ESTIMATE_UI.packagingDialogHint}
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
            onClick={() => {
              if (!unitsCheck.ok || !orderValueOk) return;
              onSave({
                unitsPerPackage: unitsCheck.units,
                packageLabel: label.trim() || "op.",
                documentUnitMode: effectiveMode,
                orderMultiple: resolvedOrderMultiple,
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
        <p className="text-[11px] font-medium text-amber-800">
          Limit {ZD_ESTIMATE_BULK_MAX} na jedną akcję — zapiszę pierwsze{" "}
          {ZD_ESTIMATE_BULK_MAX} z {lines.length}. Reszta zostanie zaznaczona.
        </p>
      ) : null}

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
            name="zd-bulk-pack-mode"
            className="mt-0.5"
            checked={effectiveMode === "packages"}
            disabled={pending}
            onChange={() => setDocumentUnitMode("packages")}
          />
          <span className="text-xs font-semibold text-slate-900">
            {ZD_ESTIMATE_UI.packagingModePackagesLabel}
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
            name="zd-bulk-pack-mode"
            className="mt-0.5"
            checked={effectiveMode === "pieces_multiple"}
            disabled={pending || pairPackBlocksPiecesMode}
            onChange={() => {
              setDocumentUnitMode("pieces_multiple");
              setOrderMultipleEnabled(false);
              setOrderMultiple("");
            }}
          />
          <span className="min-w-0">
            <span className="block text-xs font-semibold text-slate-900">
              {ZD_ESTIMATE_UI.packagingModePiecesLabel}
            </span>
            {pairPackBlocksPiecesMode ? (
              <span className="mt-0.5 block text-[11px] leading-snug text-slate-500">
                {ZD_ESTIMATE_UI.packagingModeBulkPairBlockedHint}
              </span>
            ) : null}
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
            {ZD_ESTIMATE_UI.packagingBulkUnitsHint}
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

      {packagesMode ? (
        <div className="space-y-2">
          <label
            htmlFor={orderEnableId}
            className={cn(
              "flex cursor-pointer gap-2.5 rounded-lg border px-3 py-2.5",
              orderMultipleEnabled
                ? "border-indigo-200 bg-indigo-50/50"
                : "border-slate-200 bg-white"
            )}
          >
            <input
              id={orderEnableId}
              type="checkbox"
              className="mt-0.5"
              checked={orderMultipleEnabled}
              disabled={pending}
              onChange={(e) => {
                const on = e.target.checked;
                setOrderMultipleEnabled(on);
                if (!on) setOrderMultiple("");
              }}
            />
            <span className="min-w-0">
              <span className="block text-xs font-semibold text-slate-900">
                {ZD_ESTIMATE_UI.packagingOrderMultipleEnableLabel}
              </span>
              <span className="mt-0.5 block text-[11px] leading-snug text-slate-500">
                {ZD_ESTIMATE_UI.packagingOrderMultipleEnableHint}
              </span>
            </span>
          </label>
          <div
            className={cn(
              "rounded-lg border px-3 py-2.5 transition",
              orderMultipleEnabled
                ? "border-slate-200 bg-white"
                : "border-slate-200/80 bg-slate-100/80 opacity-70"
            )}
            aria-disabled={!orderMultipleEnabled}
          >
            <label htmlFor={orderMultId} className="block">
              <span
                className={cn(
                  "text-xs font-medium",
                  orderMultipleEnabled ? "text-slate-600" : "text-slate-400"
                )}
              >
                {ZD_ESTIMATE_UI.packagingOrderMultipleLabel}
              </span>
              <Input
                id={orderMultId}
                type="number"
                min={ZD_PACKAGING_UNITS_MIN}
                max={ZD_PACKAGING_UNITS_MAX}
                value={orderMultiple}
                onChange={(e) => setOrderMultiple(e.target.value)}
                disabled={pending || !orderMultipleEnabled}
                placeholder={ZD_ESTIMATE_UI.packagingOrderMultiplePlaceholder}
                className="mt-1.5"
                aria-invalid={showOrderError || undefined}
              />
            </label>
            {orderMultipleEnabled ? (
              <>
                <p className={cn(panelTypography.caption, "mt-1")}>
                  {ZD_ESTIMATE_UI.packagingOrderMultipleHint}
                </p>
                {showOrderError && orderErrorMessage ? (
                  <p className="mt-1 text-xs font-medium text-amber-900">
                    {orderErrorMessage}
                  </p>
                ) : null}
              </>
            ) : (
              <p className={cn(panelTypography.caption, "mt-1 text-slate-400")}>
                {ZD_ESTIMATE_UI.packagingOrderMultipleOffCaption}
              </p>
            )}
          </div>
        </div>
      ) : null}

      {canSave ? (
        <div className="rounded-lg border border-emerald-200/70 bg-emerald-50/50 px-3 py-2.5">
          <p className="text-xs font-semibold text-emerald-950">
            {packagesMode
              ? `Dla każdego: 1 ${label.trim() || "op."} = ${unitsNum} szt${
                  resolvedOrderMultiple != null
                    ? ` · co ${resolvedOrderMultiple} op.`
                    : ""
                }`
              : `Dla każdego: Do ZD w sztukach, dobij do wielokrotności ${unitsNum}`}
          </p>
          <p className="mt-0.5 text-[11px] leading-snug text-emerald-900/85">
            {packagesMode
              ? ZD_ESTIMATE_UI.packagingBulkPreviewPackages
              : ZD_ESTIMATE_UI.packagingBulkPreviewPieces}
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
    <div className="rounded-lg border border-slate-200/90 bg-slate-50/70 px-3.5 py-3">
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
