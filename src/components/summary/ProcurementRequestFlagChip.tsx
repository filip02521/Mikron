"use client";

import { useState, type KeyboardEvent, type MouseEvent } from "react";
import { cn } from "@/lib/cn";
import { IconChevronDown } from "@/components/icons/StrokeIcons";
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
 * Flaga = jeden kompaktowy obiekt.
 * Domyślnie jedna linia: ● Nazwa · podgląd opisu…
 * Rozwinięcie (gdy opis długi) zostaje w tym samym chipie.
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
  const noteText = note?.trim().replace(/\s+/g, " ") || "";
  const noteRaw = note?.trim() || "";
  const hasNote = Boolean(noteRaw);
  const isOrphan = !def;
  const color: ProcurementFlagColor = def?.color ?? "slate";
  const baseLabel = def?.label ?? PROCUREMENT_REQUEST_FLAG_COPY.orphanChipLabel;
  const label =
    mixedCount != null && mixedCount > 1
      ? `${baseLabel} +${mixedCount - 1}`
      : baseLabel;
  const needsExpand = hasNote && procurementFlagNoteNeedsExpand(noteRaw);
  const [expanded, setExpanded] = useState(false);
  const showFullNote = Boolean(hasNote && needsExpand && expanded);

  const titleParts = [
    mixedCount != null && mixedCount > 1
      ? procurementFlagMixedChipLabel(mixedCount)
      : baseLabel,
    def && !def.isActive ? "Nieaktywna" : null,
    isOrphan ? "Brak definicji — odśwież lub wyczyść flagę" : null,
    hasNote ? noteRaw : null,
    onClick && !disabled ? "Kliknij, aby zmienić" : null,
  ].filter(Boolean);

  const interactive = Boolean(onClick) && !disabled;
  const shellClass = cn(
    procurementStatusChipBaseClass,
    "h-auto min-h-5 w-fit max-w-full whitespace-normal px-2 py-1 text-left leading-snug",
    showFullNote
      ? "flex-col items-stretch gap-1"
      : "items-center gap-1.5",
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

  const toggleExpand = (e: MouseEvent) => {
    e.stopPropagation();
    setExpanded((v) => !v);
  };

  const headerRow = (
    <span
      className={cn(
        "flex min-w-0 items-center gap-1.5",
        showFullNote ? "w-full" : "max-w-full"
      )}
    >
      <span
        className={cn("size-1.5 shrink-0 rounded-full", procurementFlagDotClass(color))}
        aria-hidden
      />
      <span className="shrink-0 font-semibold">{label}</span>
      {hasNote && !showFullNote ? (
        <>
          <span className="shrink-0 font-normal opacity-35" aria-hidden>
            ·
          </span>
          <span className="min-w-0 truncate font-medium opacity-80">{noteText}</span>
        </>
      ) : null}
      {needsExpand ? (
        <button
          type="button"
          data-flag-note-toggle
          className={cn(
            "ml-0.5 inline-flex shrink-0 items-center gap-0.5 rounded px-0.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide opacity-70",
            "hover:bg-black/5 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/40"
          )}
          aria-expanded={showFullNote}
          aria-label={
            showFullNote
              ? PROCUREMENT_REQUEST_FLAG_COPY.flagNoteCollapse
              : PROCUREMENT_REQUEST_FLAG_COPY.flagNoteExpand
          }
          title={
            showFullNote
              ? PROCUREMENT_REQUEST_FLAG_COPY.flagNoteCollapse
              : PROCUREMENT_REQUEST_FLAG_COPY.flagNoteExpand
          }
          onClick={toggleExpand}
        >
          <IconChevronDown
            size={12}
            open={showFullNote}
            className="opacity-80"
          />
        </button>
      ) : null}
    </span>
  );

  const body = (
    <>
      {headerRow}
      {showFullNote ? (
        <span className="min-w-0 max-w-[min(100%,22rem)] whitespace-pre-wrap break-words pl-3 text-[10px] font-medium leading-relaxed opacity-90">
          {noteRaw}
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
    <div className={shellClass} title={titleParts.join(" — ") || undefined}>
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
