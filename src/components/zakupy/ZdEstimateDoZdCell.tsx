"use client";

import { useState } from "react";
import { formatQty } from "@/lib/orders/zd-estimate-manual";
import {
  formatZdPackDocumentLabel,
  formatZdPackHint,
  formatZdPackRoundupLine,
  piecesArrivingForZdUnits,
  type ZdPackOrderQty,
} from "@/lib/orders/zd-estimate-packaging";
import { ZD_ESTIMATE_UI } from "@/lib/orders/zd-estimate-ui-copy";
import { cn } from "@/lib/cn";
import { controlFocusClass } from "@/lib/ui/ontime-theme";

/**
 * Komórka „Do ZD” — duża liczba decyzji + opcjonalne nadpisanie przed Create.
 * Przy opakowaniu: etykieta pod liczbą, sztuki przychodzące, jasne dobicie.
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
  /** @deprecated rezerwa pokazana w badge pod nazwą — prop ignorowany. */
  individualExtraPieces?: number;
  /** Nadpisanie jednostek dokumentu (null = wyliczone). */
  overrideZdUnits?: number | null;
  onOverrideChange?: (next: number | null) => void;
  overrideDisabled?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState("");

  if (excluded) {
    return (
      <span className="text-[13px] font-medium tabular-nums text-slate-300">
        —
      </span>
    );
  }

  const displayUnits =
    overrideZdUnits != null && Number.isFinite(overrideZdUnits)
      ? Math.trunc(overrideZdUnits)
      : qty.zdUnits;
  const overridden =
    overrideZdUnits != null &&
    Number.isFinite(overrideZdUnits) &&
    Math.trunc(overrideZdUnits) !== qty.zdUnits;

  /** Puste pole w trakcie edycji — nie pokazuj mylących subline z wyliczeniem. */
  const editingBlank = focused && draft.trim() === "";
  const packLabel =
    !editingBlank && qty.hasPackaging && displayUnits > 0
      ? qty.packageLabel.trim() || "op."
      : null;
  const piecesShown =
    !editingBlank && qty.hasPackaging && displayUnits > 0
      ? piecesArrivingForZdUnits(displayUnits, qty.unitsPerPackage)
      : null;
  const showPieces =
    piecesShown != null && piecesShown !== displayUnits;
  const roundupLine =
    !editingBlank &&
    !overridden &&
    qty.hasPackaging &&
    qty.zdUnits > 0
      ? formatZdPackRoundupLine(qty)
      : null;

  const docLabel = formatZdPackDocumentLabel({
    ...qty,
    zdUnits: displayUnits,
  });
  const overridePieces =
    qty.hasPackaging && displayUnits > 0
      ? piecesArrivingForZdUnits(displayUnits, qty.unitsPerPackage)
      : null;
  const baseHint = formatZdPackHint(qty);
  const fullTitle = [
    overridden
      ? [
          `Nadpisane (wyliczone: ${qty.zdUnits})`,
          overridePieces != null && docLabel
            ? `${docLabel} → ${formatQty(overridePieces)} szt`
            : null,
          "Puste/Enter przywraca.",
        ]
          .filter(Boolean)
          .join(". ")
      : baseHint || "Nadpisz ilość Do ZD przed Create",
    qty.hasPackaging ? ZD_ESTIMATE_UI.packagingOverrideHint : null,
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

  const packageSublines = (
    <>
      {packLabel ? (
        <span className="text-[10px] font-medium leading-tight text-slate-500">
          {packLabel}
        </span>
      ) : null}
      {showPieces ? (
        <span className="text-[10px] font-medium leading-tight tabular-nums text-slate-500">
          → {formatQty(piecesShown!)} szt
        </span>
      ) : null}
      {roundupLine ? (
        <span className="text-[10px] font-medium leading-tight text-amber-700/90">
          ↑ {roundupLine}
        </span>
      ) : null}
    </>
  );

  if (onOverrideChange) {
    return (
      <span className="inline-flex flex-col items-start gap-0.5">
        <input
          type="number"
          min={0}
          step={1}
          inputMode="numeric"
          value={focused ? draft : String(displayUnits)}
          disabled={overrideDisabled}
          title={fullTitle}
          aria-label={`Do ZD — nadpisanie. ${
            qty.hasPackaging ? ZD_ESTIMATE_UI.packagingOverrideHint : ""
          }`}
          className={cn(
            "h-8 w-[4.5rem] rounded-md border px-1.5 text-[1.05rem] font-semibold tabular-nums tracking-tight",
            controlFocusClass,
            overridden
              ? "border-amber-300 bg-amber-50/80 text-amber-950"
              : displayUnits > 0
                ? "border-emerald-200/90 bg-white text-emerald-900"
                : "border-slate-200 bg-white text-slate-400",
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
        {packageSublines}
        {overridden ? (
          <button
            type="button"
            className="text-[10px] font-medium text-amber-800 underline-offset-2 hover:underline"
            onClick={() => onOverrideChange(null)}
            disabled={overrideDisabled}
          >
            wyliczone: {qty.zdUnits}
          </button>
        ) : !qty.hasPackaging && displayUnits > 0 && !editingBlank ? (
          <span className="text-[10px] font-medium leading-tight text-slate-400">
            szt
          </span>
        ) : null}
      </span>
    );
  }

  return (
    <span
      className="inline-flex flex-col items-start gap-0.5"
      title={
        [
          baseHint || undefined,
          qty.hasPackaging ? ZD_ESTIMATE_UI.packagingOverrideHint : null,
        ]
          .filter(Boolean)
          .join(" ") || undefined
      }
    >
      <span
        className={cn(
          "text-[1.125rem] font-semibold leading-none tabular-nums tracking-tight",
          qty.zdUnits > 0 ? "text-emerald-900" : "text-slate-300"
        )}
      >
        {qty.zdUnits}
      </span>
      {packageSublines}
      {!qty.hasPackaging && qty.zdUnits > 0 ? (
        <span className="text-[10px] font-medium leading-tight text-slate-400">
          szt
        </span>
      ) : null}
    </span>
  );
}
