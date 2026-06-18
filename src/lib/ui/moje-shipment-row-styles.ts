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

/** Wiersze wewnątrz sekcji — bez własnych rogów; lekki dół pod ostatnim rozwiniętym wierszem. */
export const mojeShipmentListClass = "divide-y divide-slate-100 pb-0.5";

export type MojeShipmentRowVisualTone = "default" | "archive";

export function mojeShipmentRowClass({
  expanded,
  isAction,
  isInformacjaAck,
  isCancelAck,
  isUrgent,
  isStock,
  isInformacja,
  visualTone = "default",
}: {
  expanded: boolean;
  isAction: boolean;
  isInformacjaAck?: boolean;
  isCancelAck?: boolean;
  isUrgent: boolean;
  isStock?: boolean;
  isInformacja: boolean;
  visualTone?: MojeShipmentRowVisualTone;
}): string {
  if (visualTone === "archive") {
    return cn(
      "border-l-[3px] border-l-slate-200/70 transition-colors duration-150",
      expanded ? "bg-slate-50/70" : "bg-slate-50/45 hover:bg-slate-50/65"
    );
  }

  const accent = isAction
    ? "border-l-emerald-500"
    : isInformacjaAck
      ? "border-l-violet-500"
      : isCancelAck
        ? "border-l-amber-500"
        : isUrgent
          ? "border-l-amber-500"
          : isStock
            ? "border-l-sky-500"
            : isInformacja
              ? "border-l-violet-400"
              : "border-l-slate-200";

  return cn(
    "border-l-[3px] transition-colors duration-150",
    accent,
    isAction && !expanded && "bg-emerald-50/35",
    isInformacjaAck && !expanded && "bg-violet-50/40",
    isCancelAck && !expanded && "bg-amber-50/50",
    expanded
      ? "bg-slate-50/50"
      : isAction
        ? "hover:bg-emerald-50/50"
        : isInformacjaAck
          ? "hover:bg-violet-50/55"
          : isCancelAck
            ? "hover:bg-amber-50/65"
            : "bg-white hover:bg-slate-50/50"
  );
}

export const mojeShipmentExpandedRowShellClass =
  "relative z-[1] mb-2.5 shadow-sm ring-1 ring-inset ring-slate-200/70";

export const mojeShipmentExpandedMetaShellClass =
  "rounded-md border border-slate-200/80 bg-slate-50/70 px-2.5 py-1.5";

export const mojeShipmentExpandedPanelClass =
  "space-y-2.5 border-t border-slate-200/80 bg-gradient-to-b from-slate-50/90 to-white px-3 pt-2.5 pb-3.5 sm:px-4 sm:pt-3 sm:pb-4";

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
