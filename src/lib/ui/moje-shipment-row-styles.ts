import { cn } from "@/lib/cn";

/** Jedna sekcja listy (nagłówek + wiersze) — zaokrąglenie tylko na zewnątrz. */
export const mojeShipmentSectionShellClass =
  "overflow-hidden rounded-md border border-slate-200/90 bg-white shadow-sm";

/** Wiersze wewnątrz sekcji — bez własnych rogów. */
export const mojeShipmentListClass = "divide-y divide-slate-100";

export function mojeShipmentRowClass({
  expanded,
  isAction,
  isUrgent,
  isInformacja,
}: {
  expanded: boolean;
  isAction: boolean;
  isUrgent: boolean;
  isInformacja: boolean;
}): string {
  const accent = isAction
    ? "border-l-emerald-500"
    : isUrgent
      ? "border-l-amber-500"
      : isInformacja
        ? "border-l-violet-400"
        : "border-l-slate-200";

  return cn(
    "border-l-[3px] transition-colors duration-150",
    accent,
    expanded ? "bg-slate-50/40" : "bg-white hover:bg-slate-50/50"
  );
}

export const mojeShipmentExpandedPanelClass =
  "space-y-3 border-t border-slate-200/80 bg-gradient-to-b from-slate-50/90 to-white px-3 py-3 sm:px-4 sm:py-4";

export const mojeShipmentExpandedNotesClass =
  "rounded-md border border-indigo-100/90 bg-indigo-50/60 px-3 py-2 text-xs leading-relaxed text-indigo-950";

export const mojeShipmentExpandedMetaShellClass =
  "rounded-md border border-slate-200/90 bg-white px-3 py-2.5 shadow-sm";

export const mojeShipmentExpandedClientsClass =
  "rounded-md border border-slate-200/80 bg-slate-50/80 px-3 py-2 text-xs text-slate-600";

export const mojeShipmentLinesShellClass =
  "overflow-hidden rounded-md border border-slate-200/90 bg-white shadow-sm";

export const mojeShipmentLinesHeaderClass =
  "flex items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/90 px-3 py-2";

export const mojeShipmentLinesHeaderTitleClass =
  "text-xs font-semibold uppercase tracking-wide text-slate-600";

export const mojeShipmentLineRowClass =
  "border-b border-slate-100 px-3 py-2.5 last:border-b-0 sm:py-3";

export const mojeShipmentExpandedActionsClass =
  "flex justify-end border-t border-slate-100 bg-slate-50/60 px-3 py-2.5";

/** @deprecated użyj mojeShipmentLinesShellClass */
export const mojeShipmentLinesListClass = mojeShipmentLinesShellClass;

/** @deprecated użyj mojeShipmentSectionShellClass */
export const mojeShipmentListShellClass = mojeShipmentSectionShellClass;
