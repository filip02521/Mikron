import { cn } from "@/lib/cn";
import { salesTypography } from "@/lib/ui/ontime-theme";

/** Jedna sekcja listy (nagłówek + wiersze) — zaokrąglenie tylko na zewnątrz. */
export const mojeShipmentSectionShellClass =
  "overflow-hidden rounded-md border border-slate-200/90 bg-white shadow-sm";

/** Układ wiersza — treść nad akcjami na wąskim ekranie. */
export const mojeQueueRowLayoutClass =
  "flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2";

/** Slot akcji w wierszu — pełna szerokość na mobile. */
export const mojeQueueRowActionsClass =
  "w-full border-t border-slate-100/90 pt-2 sm:w-auto sm:shrink-0 sm:border-0 sm:pt-0 sm:self-center";

/** Główna treść wiersza (chevron + opis). */
export const mojeQueueRowMainClass = "flex min-w-0 flex-1 items-center gap-1 sm:gap-2";

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

export const mojeShipmentExpandedMetaShellClass =
  "rounded-md border border-slate-200/80 bg-slate-50/70 px-2.5 py-1.5";

export const mojeShipmentExpandedPanelClass =
  "space-y-2.5 border-t border-slate-200/80 bg-gradient-to-b from-slate-50/90 to-white px-3 py-2.5 sm:px-4 sm:py-3";

export const mojeShipmentExpandedNotesClass =
  "rounded-md border border-indigo-100/90 bg-indigo-50/60 px-3 py-2 text-xs leading-relaxed text-indigo-950";

export const mojeShipmentExpandedClientsClass =
  "rounded-md border border-slate-200/80 bg-slate-50/80 px-3 py-2 text-xs text-slate-600";

export const mojeShipmentLinesHeaderClass =
  "flex items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/90 px-3 py-1.5";

export const mojeShipmentLinesHeaderTitleClass = cn(
  salesTypography.sectionLabel,
  "normal-case tracking-normal text-slate-600"
);

export const mojeShipmentLinesShellClass =
  "overflow-hidden rounded-md border border-slate-200/90 bg-white shadow-sm";

export const mojeShipmentLineRowClass =
  "border-b border-slate-100 px-3 py-2.5 last:border-b-0 sm:py-3";

export const mojeShipmentExpandedActionsClass =
  "flex justify-end border-t border-slate-100 bg-slate-50/60 px-3 py-2.5";

/** @deprecated użyj mojeShipmentLinesShellClass */
export const mojeShipmentLinesListClass = mojeShipmentLinesShellClass;

/** @deprecated użyj mojeShipmentSectionShellClass */
export const mojeShipmentListShellClass = mojeShipmentSectionShellClass;
