"use client";

import { useState } from "react";
import { formatQty } from "@/lib/orders/zd-estimate-manual";
import {
  formatZdPackDocumentLabel,
  formatZdPackHint,
  formatZdPackRoundupLine,
  getZdPackRoundupInfo,
  isPackagingPackagesMode,
  piecesArrivingForZdUnits,
  type ZdPackOrderQty,
} from "@/lib/orders/zd-estimate-packaging";
import { formatZdEstimateTableQty } from "@/lib/orders/zd-estimate-table-qty";
import { ZD_ESTIMATE_UI } from "@/lib/orders/zd-estimate-ui-copy";
import { cn } from "@/lib/cn";
import { controlFocusClass } from "@/lib/ui/ontime-theme";

/**
 * Komórka „Do ZD” — decyzja: wartość (+ unit) w jednej linii;
 * roundup / przywróć tylko gdy potrzeba.
 */
export function ZdEstimateDoZdCell({
  qty,
  excluded,
  overrideZdUnits,
  onOverrideChange,
  overrideDisabled,
}: {
  qty: ZdPackOrderQty;
  excluded?: boolean;
  /** @deprecated rezerwa pokazana w badge Status — prop ignorowany. */
  individualExtraPieces?: number;
  overrideZdUnits?: number | null;
  onOverrideChange?: (next: number | null) => void;
  overrideDisabled?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState("");

  if (excluded) {
    return (
      <span className="zd-est-qty--a zd-est-qty--dash tabular-nums">—</span>
    );
  }

  const packagesMode = isPackagingPackagesMode(qty.documentUnitMode);
  const displayUnits =
    overrideZdUnits != null && Number.isFinite(overrideZdUnits)
      ? Math.trunc(overrideZdUnits)
      : qty.zdUnits;
  const overridden =
    overrideZdUnits != null &&
    Number.isFinite(overrideZdUnits) &&
    Math.trunc(overrideZdUnits) !== qty.zdUnits;

  const editingBlank = focused && draft.trim() === "";
  const roundupInfo =
    !editingBlank &&
    !overridden &&
    qty.hasPackaging &&
    qty.zdUnits > 0
      ? getZdPackRoundupInfo(qty)
      : null;
  const roundupFull = roundupInfo ? formatZdPackRoundupLine(qty) : null;

  const docLabel = formatZdPackDocumentLabel({
    ...qty,
    zdUnits: displayUnits,
  });
  const overridePieces =
    qty.hasPackaging && displayUnits > 0
      ? piecesArrivingForZdUnits(
          displayUnits,
          qty.unitsPerPackage,
          qty.documentUnitMode
        )
      : null;
  const overrideHint = packagesMode
    ? ZD_ESTIMATE_UI.packagingOverrideHint
    : ZD_ESTIMATE_UI.packagingOverrideHintPieces;
  const baseHint = formatZdPackHint(qty);

  const fullTitle = [
    overridden
      ? [
          `Nadpisane (wyliczone: ${qty.zdUnits})`,
          packagesMode && overridePieces != null && docLabel
            ? `${docLabel} → ${formatQty(overridePieces)} szt`
            : !packagesMode && overridePieces != null
              ? `${formatQty(overridePieces)} szt`
              : null,
          "Puste/Enter przywraca.",
        ]
          .filter(Boolean)
          .join(". ")
      : baseHint || "Nadpisz ilość Do ZD przed utworzeniem dokumentu",
    roundupFull ? `↑ ${roundupFull}` : null,
    qty.hasPackaging ? overrideHint : null,
  ]
    .filter(Boolean)
    .join(" ");

  const commitDraft = (raw: string) => {
    if (!onOverrideChange) return;
    const trimmed = raw.trim();
    if (trimmed === "") {
      onOverrideChange(null);
      return;
    }
    const n = Number(trimmed);
    if (!Number.isFinite(n) || n < 0) {
      onOverrideChange(null);
      return;
    }
    const units = Math.trunc(n);
    onOverrideChange(units === qty.zdUnits ? null : units);
  };

  const showSztUnit =
    !qty.hasPackaging && displayUnits > 0 && !editingBlank;

  const hintLine =
    overridden && onOverrideChange ? (
      <button
        type="button"
        className="zd-est-dozd-reset"
        onClick={() => onOverrideChange(null)}
        disabled={overrideDisabled}
        title={`Przywróć wyliczone: ${qty.zdUnits}`}
      >
        wylicz. {qty.zdUnits}
      </button>
    ) : roundupInfo != null ? (
      <span className="zd-est-dozd-hint" title={roundupFull ?? undefined}>
        ↑ +{roundupInfo.extra} ({roundupInfo.need}→{roundupInfo.arrive})
      </span>
    ) : null;

  if (onOverrideChange) {
    return (
      <span
        className="flex w-full min-w-0 max-w-full flex-col items-start gap-0.5 overflow-hidden"
        title={fullTitle}
      >
        <span className="zd-est-dozd-value">
          <input
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            value={focused ? draft : String(displayUnits)}
            disabled={overrideDisabled}
            title={fullTitle}
            aria-label={`Do ZD — nadpisanie. ${
              qty.hasPackaging ? overrideHint : ""
            }`}
            className={cn(
              "zd-est-dozd-input",
              controlFocusClass,
              overridden && "zd-est-dozd-input--override",
              !overridden && displayUnits <= 0 && "zd-est-dozd-input--idle",
              "disabled:cursor-not-allowed disabled:opacity-50"
            )}
            onFocus={() => {
              setFocused(true);
              setDraft(String(displayUnits));
            }}
            onChange={(e) => {
              const raw = e.target.value;
              setDraft(raw);
              const trimmed = raw.trim();
              if (trimmed === "") {
                onOverrideChange(null);
                return;
              }
              const n = Number(trimmed);
              if (!Number.isFinite(n) || n < 0) return;
              const units = Math.trunc(n);
              onOverrideChange(units === qty.zdUnits ? null : units);
            }}
            onBlur={() => {
              commitDraft(draft);
              setFocused(false);
            }}
          />
          {showSztUnit ? <span className="zd-est-unit">szt</span> : null}
        </span>
        {hintLine}
      </span>
    );
  }

  return (
    <span
      className="flex w-full min-w-0 max-w-full flex-col items-start gap-0.5 overflow-hidden"
      title={
        [
          baseHint || undefined,
          roundupFull ? `↑ ${roundupFull}` : null,
          qty.hasPackaging ? overrideHint : null,
        ]
          .filter(Boolean)
          .join(" ") || undefined
      }
    >
      <span className="zd-est-dozd-value">
        <span
          className={cn(
            "zd-est-qty--a",
            displayUnits > 0 ? "zd-est-qty--decision" : "zd-est-qty--dash"
          )}
        >
          {formatZdEstimateTableQty(displayUnits)}
        </span>
        {!qty.hasPackaging && displayUnits > 0 ? (
          <span className="zd-est-unit">szt</span>
        ) : null}
      </span>
      {hintLine}
    </span>
  );
}
