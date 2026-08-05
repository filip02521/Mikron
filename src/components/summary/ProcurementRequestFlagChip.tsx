"use client";

import { useState, type KeyboardEvent, type MouseEvent } from "react";
import { cn } from "@/lib/cn";
import {
  buildFlagSortOrderMap,
  findFlagDefinition,
  procurementFlagChipClass,
  procurementFlagDotClass,
  procurementFlagMixedChipLabel,
  procurementFlagNoteNeedsExpand,
  summarizeGroupProcurementFlags,
  type ForSomeoneLineFlagFields,
  type ProcurementFlagColor,
  type ProcurementFlagDefinition,
  type ProcurementRequestFlag,
} from "@/lib/orders/procurement-request-flag";
import { PROCUREMENT_REQUEST_FLAG_COPY } from "@/lib/orders/procurement-request-flag-copy";
import {
  procurementStatusChipBaseClass,
  procurementStatusChipDisabledClass,
  procurementStatusChipInteractiveClass,
} from "@/lib/ui/procurement-status-chips";

/**
 * Jedna flaga = jeden obiekt UI: nazwa + opis w tym samym chipie.
 * Długi opis zwija się wewnątrz (bez osobnego bloku pod spodem).
 */
export function ProcurementRequestFlagChip({
  flag,
  note,
  definitions,
  mixedCount,
  onClick,
  disabled,
  className,
}: {
  flag: ProcurementRequestFlag;
  note?: string | null;
  definitions: ProcurementFlagDefinition[];
  mixedCount?: number;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  const def = findFlagDefinition(definitions, flag);
  const noteText = note?.trim() || "";
  const hasNote = Boolean(noteText);
  const isOrphan = !def;
  const color: ProcurementFlagColor = def?.color ?? "slate";
  const baseLabel = def?.label ?? PROCUREMENT_REQUEST_FLAG_COPY.orphanChipLabel;
  const label =
    mixedCount != null && mixedCount > 1
      ? `${baseLabel} +${mixedCount - 1}`
      : baseLabel;
  const needsExpand = hasNote && procurementFlagNoteNeedsExpand(noteText);
  const [expanded, setExpanded] = useState(false);
  const showFullNote = !needsExpand || expanded;

  const titleParts = [
    mixedCount != null && mixedCount > 1
      ? procurementFlagMixedChipLabel(mixedCount)
      : baseLabel,
    def && !def.isActive ? "Nieaktywna" : null,
    isOrphan ? "Brak definicji — odśwież lub wyczyść flagę" : null,
    hasNote ? PROCUREMENT_REQUEST_FLAG_COPY.flagNoteHint : null,
    onClick && !disabled ? "Kliknij, aby zmienić" : null,
  ].filter(Boolean);

  const interactive = Boolean(onClick) && !disabled;
  const shellClass = cn(
    procurementStatusChipBaseClass,
    "h-auto min-h-5 w-full max-w-full flex-col items-stretch gap-1 whitespace-normal px-2 py-1.5 text-left leading-snug",
    procurementFlagChipClass(color),
    (isOrphan || (def && !def.isActive)) && "opacity-70",
    interactive && procurementStatusChipInteractiveClass,
    disabled && procurementStatusChipDisabledClass,
    className
  );

  const openEditor = () => {
    if (!interactive || !onClick) return;
    onClick();
  };

  const onShellClick = (e: MouseEvent) => {
    if ((e.target as HTMLElement).closest("[data-flag-note-toggle]")) return;
    openEditor();
  };

  const onShellKeyDown = (e: KeyboardEvent) => {
    if (!interactive) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openEditor();
    }
  };

  const body = (
    <>
      <span className="flex min-w-0 items-start gap-1.5">
        <span
          className={cn(
            "mt-[3px] size-1.5 shrink-0 rounded-full",
            procurementFlagDotClass(color)
          )}
          aria-hidden
        />
        <span className="min-w-0 break-words font-semibold">{label}</span>
      </span>
      {hasNote ? (
        <span className="flex min-w-0 flex-col gap-0.5 pl-3">
          <span
            className={cn(
              "min-w-0 whitespace-pre-wrap break-words text-[10px] font-medium leading-snug opacity-90",
              !showFullNote && "line-clamp-3"
            )}
          >
            {noteText}
          </span>
          {needsExpand ? (
            <button
              type="button"
              data-flag-note-toggle
              className="self-start text-[10px] font-semibold underline-offset-2 opacity-80 hover:underline hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/40"
              aria-expanded={showFullNote}
              onClick={(e) => {
                e.stopPropagation();
                setExpanded((v) => !v);
              }}
            >
              {showFullNote
                ? PROCUREMENT_REQUEST_FLAG_COPY.flagNoteCollapse
                : PROCUREMENT_REQUEST_FLAG_COPY.flagNoteExpand}
            </button>
          ) : null}
        </span>
      ) : null}
    </>
  );

  if (interactive) {
    return (
      <div
        role="button"
        tabIndex={0}
        className={shellClass}
        title={titleParts.join(" — ") || PROCUREMENT_REQUEST_FLAG_COPY.emptyChipTitle}
        onClick={onShellClick}
        onKeyDown={onShellKeyDown}
      >
        {body}
      </div>
    );
  }

  return (
    <div
      className={shellClass}
      title={titleParts.join(" — ") || undefined}
    >
      {body}
    </div>
  );
}

export function ProcurementRequestFlagGroupChip({
  lines,
  definitions,
  onClick,
  disabled,
  className,
}: {
  lines: ForSomeoneLineFlagFields[];
  definitions: ProcurementFlagDefinition[];
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  const summary = summarizeGroupProcurementFlags(
    lines,
    buildFlagSortOrderMap(definitions)
  );
  if (summary.kind === "none") return null;
  if (summary.kind === "single") {
    return (
      <ProcurementRequestFlagChip
        flag={summary.flag}
        note={summary.note}
        definitions={definitions}
        onClick={onClick}
        disabled={disabled}
        className={className}
      />
    );
  }
  return (
    <ProcurementRequestFlagChip
      flag={summary.highestFlag}
      mixedCount={summary.flaggedCount}
      definitions={definitions}
      onClick={onClick}
      disabled={disabled}
      className={className}
    />
  );
}
