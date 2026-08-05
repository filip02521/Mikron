"use client";

import { cn } from "@/lib/cn";
import {
  buildFlagSortOrderMap,
  findFlagDefinition,
  procurementFlagChipClass,
  procurementFlagDotClass,
  procurementFlagMixedChipLabel,
  shortProcurementFlagLabel,
  summarizeGroupProcurementFlags,
  type ForSomeoneLineFlagFields,
  type ProcurementFlagDefinition,
  type ProcurementRequestFlag,
} from "@/lib/orders/procurement-request-flag";
import { PROCUREMENT_REQUEST_FLAG_COPY } from "@/lib/orders/procurement-request-flag-copy";
import {
  procurementStatusChipBaseClass,
  procurementStatusChipDisabledClass,
  procurementStatusChipInteractiveClass,
} from "@/lib/ui/procurement-status-chips";

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
  const hasNote = Boolean(note?.trim());
  const isOrphan = !def;
  const color = def?.color ?? "slate";
  const displayLabel = def
    ? shortProcurementFlagLabel(def.label)
    : PROCUREMENT_REQUEST_FLAG_COPY.orphanChipLabel;
  const label =
    mixedCount != null && mixedCount > 1
      ? `${displayLabel} +${mixedCount - 1}`
      : displayLabel;
  const titleParts = [
    mixedCount != null && mixedCount > 1
      ? procurementFlagMixedChipLabel(mixedCount)
      : def?.label ?? PROCUREMENT_REQUEST_FLAG_COPY.orphanChipLabel,
    def && !def.isActive ? "Nieaktywna" : null,
    isOrphan ? "Brak definicji — odśwież lub wyczyść flagę" : null,
    hasNote ? note!.trim() : null,
    onClick && !disabled ? "Kliknij, aby zmienić" : null,
  ].filter(Boolean);

  const chipClass = cn(
    procurementStatusChipBaseClass,
    procurementFlagChipClass(color),
    (isOrphan || (def && !def.isActive)) && "opacity-70",
    onClick && !disabled && procurementStatusChipInteractiveClass,
    disabled && procurementStatusChipDisabledClass,
    className
  );

  const inner = (
    <>
      <span
        className={cn("size-1.5 shrink-0 rounded-full", procurementFlagDotClass(color))}
        aria-hidden
      />
      <span className="truncate">{label}</span>
      {hasNote ? (
        <span
          className="max-w-[7rem] truncate text-[9px] font-medium opacity-80"
          title={note!.trim()}
        >
          {shortProcurementFlagLabel(note!.trim(), 14)}
        </span>
      ) : null}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        className={chipClass}
        title={titleParts.join(" — ") || PROCUREMENT_REQUEST_FLAG_COPY.emptyChipTitle}
        disabled={disabled}
        onClick={onClick}
      >
        {inner}
      </button>
    );
  }

  return (
    <span className={chipClass} title={titleParts.join(" — ") || undefined}>
      {inner}
    </span>
  );
}

export function ProcurementRequestFlagGroupChip({
  lines,
  definitions,
  onClick,
  disabled,
}: {
  lines: ForSomeoneLineFlagFields[];
  definitions: ProcurementFlagDefinition[];
  onClick?: () => void;
  disabled?: boolean;
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
    />
  );
}
