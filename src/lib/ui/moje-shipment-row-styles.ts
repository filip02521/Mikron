import { cn } from "@/lib/cn";
import { salesTypography } from "@/lib/ui/ontime-theme";

/** Jedna sekcja listy (nagłówek + wiersze) — zaokrąglenie tylko na zewnątrz. */
export const mojeShipmentSectionShellClass =
  "overflow-hidden rounded-xl border border-slate-200/80 bg-white";

/** Układ wiersza — treść nad akcjami na wąskim ekranie. */
export const mojeQueueRowLayoutClass =
  "flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2";

/** Slot akcji inline — bez border-t na mobile (ack-only). */
export const mojeQueueRowActionsInlineClass =
  "w-full sm:w-auto sm:shrink-0 sm:self-center";

/** Slot akcji w wierszu — pełna szerokość na mobile. */
export const mojeQueueRowActionsClass =
  "w-full border-t border-slate-100/90 pt-2 sm:w-auto sm:shrink-0 sm:border-0 sm:pt-0 sm:self-center";

/** Główna treść wiersza (chevron + opis). */
export const mojeQueueRowMainClass = "flex min-w-0 flex-1 items-center gap-1 sm:gap-2";

/** Wiersze wewnątrz sekcji — bez własnych rogów; lekki dół pod ostatnim rozwiniętym wierszem. */
export const mojeShipmentListClass = "divide-y divide-slate-100 pb-0.5";

export type MojeShipmentRowVisualTone = "default" | "archive";

export type MojeShipmentRowArchiveAccent =
  | "completed"
  | "cancelled"
  | "informacja"
  | "default";

export function mojeShipmentRowClass({
  expanded,
  isAction,
  isInformacjaAck,
  isCancelAck,
  isDismiss,
  isUrgent,
  visualTone = "default",
}: {
  expanded: boolean;
  isAction: boolean;
  isInformacjaAck?: boolean;
  isCancelAck?: boolean;
  isDismiss?: boolean;
  isUrgent: boolean;
  isStock?: boolean;
  isInformacja: boolean;
  visualTone?: MojeShipmentRowVisualTone;
  /** @deprecated Wiersze w toku są neutralne — akcent tylko dla akcji/problemów. */
  deliveryBorderAccent?: string | null;
  /** @deprecated jw. */
  deliveryCollapsedBg?: string | null;
  archiveAccent?: MojeShipmentRowArchiveAccent;
}): string {
  if (visualTone === "archive") {
    // Archiwum: bez kolorowych pasków — status mówi tekst wiersza.
    return cn(
      "border-l-2 border-l-transparent transition-colors duration-150",
      expanded ? "bg-slate-50/60" : "bg-white hover:bg-slate-50/70"
    );
  }

  // Stonowana lista: bez kolorowych teł wierszy. Wąski akcent tylko tam, gdzie handlowiec
  // musi coś zrobić (odbiór, potwierdzenie) albo jest problem (opóźnienie).
  const accent = isAction
    ? "border-l-emerald-500"
    : isInformacjaAck
      ? "border-l-violet-400"
      : isDismiss || isCancelAck
        ? "border-l-amber-400"
        : isUrgent
          ? "border-l-amber-400"
          : "border-l-transparent";

  return cn(
    "border-l-2 transition-colors duration-150",
    accent,
    expanded ? "bg-slate-50/60" : "bg-white hover:bg-slate-50/70"
  );
}

export const mojeShipmentExpandedRowShellClass =
  "relative z-[2] my-1 rounded-lg shadow-sm ring-1 ring-slate-200/80";

export const mojeShipmentExpandedMetaShellClass =
  "px-0 py-0";

export const mojeShipmentExpandedPanelClass =
  "space-y-2 rounded-lg border border-slate-200/70 bg-white shadow-sm shadow-slate-200/30 px-3 py-3 sm:px-4 sm:py-3.5";

export const mojeShipmentExpandedInfoBlockClass =
  "space-y-1.5 px-3 py-2";

export const mojeShipmentExpandedNotesClass =
  "text-xs leading-relaxed text-slate-600";

export const mojeShipmentExpandedClientsClass =
  "rounded-md border border-slate-200/80 bg-slate-50/80 px-3 py-2 text-xs text-slate-600";

export const mojeShipmentSectionHeaderClass =
  "flex items-center justify-between gap-2 border-b border-slate-200/80 bg-slate-50/80 px-3 py-1.5";

export const mojeShipmentSectionHeaderTitleClass = cn(
  salesTypography.sectionLabel,
  "normal-case tracking-normal text-slate-500"
);

export const mojeShipmentLinesHeaderClass =
  "flex items-center justify-between gap-2 border-b border-slate-200/80 bg-slate-50/80 px-3 py-1.5";

export const mojeShipmentLinesHeaderTitleClass = cn(
  salesTypography.sectionLabel,
  "normal-case tracking-normal text-slate-500"
);

export const mojeShipmentLinesShellClass =
  "overflow-hidden rounded-lg border border-slate-200/70 bg-white";

export const mojeShipmentLineRowClass =
  "border-b border-slate-100 px-3 py-2 last:border-b-0 sm:py-2.5";

/** Stała szerokość kolumny akcji przy rozwiniętej liście z potwierdzeniami per pozycja. */
export const mojeShipmentLineActionColumnClass =
  "flex w-full min-w-0 flex-col items-stretch gap-1.5 self-start sm:w-auto sm:max-w-[14rem]";

/** Kompaktowy trigger ⋮ przy pozycji produktu — widoczny, spójny z menu karty. */
export const mojeLineCancelMenuTriggerClass = cn(
  "h-8 w-8 border-transparent bg-transparent text-slate-400 shadow-none",
  "hover:border-slate-200 hover:bg-white hover:text-slate-700"
);

/** Stopka zbiorczego potwierdzenia pod listą produktów. */
export const mojeShipmentBulkPickupFooterClass =
  "border-t border-emerald-100/90 bg-gradient-to-b from-emerald-50/50 via-emerald-50/20 to-white px-3 py-3 sm:px-4";

export const mojeShipmentExpandedActionsClass =
  "flex justify-end border-t border-slate-100 bg-slate-50/60 px-3 py-2.5";

/** @deprecated użyj mojeShipmentLinesShellClass */
export const mojeShipmentLinesListClass = mojeShipmentLinesShellClass;

/** @deprecated użyj mojeShipmentSectionShellClass */
export const mojeShipmentListShellClass = mojeShipmentSectionShellClass;
