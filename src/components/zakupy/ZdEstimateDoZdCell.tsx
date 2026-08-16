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
import {
  buildZdEstimateConfidenceUi,
  resolveZdEstimateDoZdHintKind,
} from "@/lib/orders/zd-estimate-confidence-ui";
import type { SalesTrackReason } from "@/lib/orders/zd-estimate-sales-track";
import { ZD_ESTIMATE_UI } from "@/lib/orders/zd-estimate-ui-copy";
import { cn } from "@/lib/cn";
import { controlFocusClass } from "@/lib/ui/ontime-theme";

/**
 * Komórka „Do ZD” — decyzja + opcjonalny whisper pewności pod ilością.
 * Roundup / przywróć mają priorytet nad whisperem (pewność wtedy tylko w title).
 */
export function ZdEstimateDoZdCell({
  qty,
  excluded,
  overrideZdUnits,
  onOverrideChange,
  overrideDisabled,
  confidence = 0,
  qtyReview = false,
  reasons = [],
  accepted = false,
  detailHint,
  onAccept,
}: {
  qty: ZdPackOrderQty;
  excluded?: boolean;
  /** @deprecated rezerwa pokazana w badge Status — prop ignorowany. */
  individualExtraPieces?: number;
  overrideZdUnits?: number | null;
  onOverrideChange?: (next: number | null) => void;
  overrideDisabled?: boolean;
  confidence?: number;
  qtyReview?: boolean;
  reasons?: readonly SalesTrackReason[];
  accepted?: boolean;
  detailHint?: string;
  onAccept?: () => void;
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

  const confidenceUi = buildZdEstimateConfidenceUi({
    confidence,
    qtyReview,
    reasons,
    accepted,
    detailHint,
    canAccept: Boolean(onAccept),
  });

  const hasPiecesSubline =
    packagesMode &&
    !editingBlank &&
    displayUnits > 0 &&
    overridePieces != null &&
    overridePieces !== displayUnits;

  const hintKind = resolveZdEstimateDoZdHintKind({
    overridden: overridden && Boolean(onOverrideChange),
    hasRoundup: roundupInfo != null,
    showConfidenceWhisper: confidenceUi.hasSignal,
    hasPiecesSubline,
  });

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
    confidenceUi.hasSignal ? confidenceUi.title || null : null,
  ]
    .filter(Boolean)
    .join(" · ");

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
  const showPackUnit =
    qty.hasPackaging &&
    packagesMode &&
    displayUnits > 0 &&
    !editingBlank;
  const showPiecesUnit =
    qty.hasPackaging &&
    !packagesMode &&
    displayUnits > 0 &&
    !editingBlank;

  const piecesSubline = hasPiecesSubline ? (
    <span className="zd-est-unit tabular-nums">
      → {formatQty(overridePieces!)} szt
    </span>
  ) : null;

  const confidenceWhisper =
    confidenceUi.hasSignal && hintKind === "confidence" ? (
      <span
        className={cn(
          "zd-est-dozd-confidence",
          confidenceUi.tone === "review" && "zd-est-dozd-confidence--review",
          confidenceUi.tone === "accepted" &&
            "zd-est-dozd-confidence--accepted",
          confidenceUi.tone === "ok" && "zd-est-dozd-confidence--ok"
        )}
        title={confidenceUi.title || undefined}
      >
        <span className="zd-est-dozd-confidence__pct tabular-nums">
          {confidenceUi.pct}%
        </span>
        {confidenceUi.needsReview && onAccept ? (
          <button
            type="button"
            className="zd-est-dozd-confidence__accept"
            onClick={onAccept}
            title={confidenceUi.title || undefined}
            aria-label={confidenceUi.acceptAriaLabel}
          >
            OK
          </button>
        ) : confidenceUi.needsReview ? (
          <span className="zd-est-dozd-confidence__dot" aria-hidden />
        ) : null}
      </span>
    ) : null;

  const hintLine =
    hintKind === "override" && onOverrideChange ? (
      <button
        type="button"
        className="zd-est-dozd-reset"
        onClick={() => onOverrideChange(null)}
        disabled={overrideDisabled}
        title={`Przywróć wyliczone: ${qty.zdUnits}`}
      >
        wylicz. {qty.zdUnits}
      </button>
    ) : hintKind === "roundup" && roundupInfo != null ? (
      <span className="zd-est-dozd-hint" title={roundupFull ?? undefined}>
        ↑ +{roundupInfo.extra} ({roundupInfo.need}→{roundupInfo.arrive})
      </span>
    ) : hintKind === "confidence" ? (
      confidenceWhisper
    ) : (
      piecesSubline
    );

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
          {showSztUnit || showPiecesUnit ? (
            <span className="zd-est-unit">szt</span>
          ) : null}
          {showPackUnit ? (
            <span className="zd-est-unit">
              {qty.packageLabel.trim() || "op."}
            </span>
          ) : null}
        </span>
        {hintLine}
      </span>
    );
  }

  return (
    <span
      className="flex w-full min-w-0 max-w-full flex-col items-start gap-0.5 overflow-hidden"
      title={fullTitle || undefined}
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
        {showSztUnit || showPiecesUnit ? (
          <span className="zd-est-unit">szt</span>
        ) : null}
        {showPackUnit ? (
          <span className="zd-est-unit">
            {qty.packageLabel.trim() || "op."}
          </span>
        ) : null}
      </span>
      {hintLine}
    </span>
  );
}
