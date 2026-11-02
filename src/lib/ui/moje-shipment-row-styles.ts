import { cn } from "@/lib/cn";
import { salesTypography } from "@/lib/ui/ontime-theme";

/** Jedna sekcja listy (nagłówek + wiersze) — zaokrąglenie tylko na zewnątrz. */
export const mojeShipmentSectionShellClass =
  "overflow-hidden rounded-lg border border-slate-200/80 bg-card shadow-sm shadow-slate-200/40";

/** Układ wiersza — treść nad akcjami na wąskim ekranie. */
export const mojeQueueRowLayoutClass =
  "flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2";

/** Slot akcji inline — bez border-t na mobile (ack-only). */
export const mojeQueueRowActionsInlineClass =
  "w-full empty:hidden sm:w-auto sm:shrink-0 sm:self-center";

/** Slot akcji w wierszu — pełna szerokość na mobile. */
export const mojeQueueRowActionsClass =
  "w-full border-t border-slate-100/90 pt-2 empty:hidden sm:w-auto sm:shrink-0 sm:border-0 sm:pt-0 sm:self-center";

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
  isDismiss,
  isUrgent,
  isStock,
  visualTone = "default",
  deliveryBorderAccent,
  deliveryCollapsedBg,
}: {
  expanded: boolean;
  isAction: boolean;
  isInformacjaAck?: boolean;
  isCancelAck?: boolean;
  isDismiss?: boolean;
  isUrgent: boolean;
  isStock?: boolean;
  visualTone?: MojeShipmentRowVisualTone;
  deliveryBorderAccent?: string | null;
  deliveryCollapsedBg?: string | null;
}): string {
  // Stan wiersza niesie tło i zdanie stanu w wierszu, bez paska z boku (DESIGN.md → Shapes).
  if (visualTone === "archive") {
    return cn(
      "transition duration-150",
      expanded ? "bg-slate-100/80" : "bg-slate-50/45 hover:bg-slate-50/80"
    );
  }

  // Po terminie (dawniej bursztynowy pasek z `deliveryUrgencyRowVisual`) zostaje wyróżnione tłem.
  const isOverdue = isUrgent || deliveryBorderAccent === "border-l-amber-500";

  return cn(
    "transition duration-150",
    // Nagłówek rozwiniętego wiersza wyraźnie ciemniejszy niż zwinięte — tu zaczyna się otwarta prośba.
    expanded
      ? "bg-slate-100/80"
      : isAction
        ? "bg-emerald-50/60 hover:bg-emerald-50"
        : isInformacjaAck
          ? "bg-indigo-50/60 hover:bg-indigo-50"
          : isDismiss
            ? "bg-red-50/45 hover:bg-red-50/80"
            : isCancelAck || isOverdue
              ? "bg-amber-50/35 hover:bg-amber-50/70"
              : deliveryCollapsedBg
                ? cn(deliveryCollapsedBg, "hover:brightness-[0.98]")
                : isStock
                  ? "bg-slate-50/70 hover:bg-slate-50"
                  : "bg-card hover:bg-slate-50/70"
  );
}

/**
 * Rozwinięty wiersz zostaje w liście (bez zaokrągleń i marginesów — przesuwały sąsiadów), ale ma
 * wyraźne granice: ramkę na całym obwodzie, żeby było widać, gdzie otwarta prośba się kończy.
 */
export const mojeShipmentExpandedRowShellClass = cn(
  "relative z-[1]",
  // Ramka na warstwie nad treścią (::after) — wewnętrzny cień na samym wierszu zasłaniał biały panel
  // szczegółów. Obwód w kolorze Linii Mocnej, bez cienia w karcie (DESIGN.md → Cichy cień).
  "after:pointer-events-none after:absolute after:inset-0 after:content-[''] after:ring-1 after:ring-inset after:ring-slate-300"
);

export const mojeShipmentExpandedMetaShellClass =
  "px-0 py-0";

/** Szczegóły pod nagłówkiem wiersza: płaskie, oddzielone cienką linią — bez karty w karcie. */
export const mojeShipmentExpandedPanelClass =
  "space-y-2 border-t border-slate-200/70 bg-card px-3 py-3 sm:px-4 sm:py-3.5";

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
  "overflow-hidden rounded-lg border border-slate-200/70 bg-card";

export const mojeShipmentLineRowClass =
  "border-b border-slate-100 px-3 py-2 last:border-b-0 sm:py-2.5";

/** Stała szerokość kolumny akcji przy rozwiniętej liście z potwierdzeniami per pozycja. */
export const mojeShipmentLineActionColumnClass =
  "flex w-full min-w-0 flex-col items-stretch gap-1.5 self-start sm:w-auto sm:max-w-[14rem]";

/** Kompaktowy trigger ⋮ przy pozycji produktu — widoczny, spójny z menu karty. */
export const mojeLineCancelMenuTriggerClass = cn(
  "h-8 w-8 border-slate-200/90 text-slate-500 shadow-sm",
  "hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700"
);

/** Stopka zbiorczego potwierdzenia pod listą produktów. */
export const mojeShipmentBulkPickupFooterClass =
  "border-t border-emerald-100/90 bg-emerald-50/50 px-3 py-3 sm:px-4";

export const mojeShipmentExpandedActionsClass =
  "flex justify-end border-t border-slate-100 bg-slate-50/60 px-3 py-2.5";

/** @deprecated użyj mojeShipmentLinesShellClass */
export const mojeShipmentLinesListClass = mojeShipmentLinesShellClass;

/** @deprecated użyj mojeShipmentSectionShellClass */
export const mojeShipmentListShellClass = mojeShipmentSectionShellClass;
