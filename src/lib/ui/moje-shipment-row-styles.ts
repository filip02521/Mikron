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
    expanded ? "bg-slate-50/70" : "bg-white hover:bg-slate-50/50"
  );
}

export const mojeShipmentExpandedPanelClass =
  "border-t border-slate-100 bg-slate-50/80 px-3 pb-3 pt-2.5 sm:px-4";

/** Lista towarów w rozwinięciu — płasko, bez drugiego „kartonu” z rogami. */
export const mojeShipmentLinesListClass =
  "mt-2 divide-y divide-slate-200/80 border-t border-slate-200/80 bg-white";

/** @deprecated użyj mojeShipmentSectionShellClass */
export const mojeShipmentListShellClass = mojeShipmentSectionShellClass;
