import { cn } from "@/lib/cn";
import {
  deliveryMetaTypography,
  panelTypography,
  surfaceCardClass,
} from "@/lib/ui/ontime-theme";

export type UrgentCardTone = "overdue" | "today";

export function urgentCardTone(isOverdue: boolean): UrgentCardTone {
  return isOverdue ? "overdue" : "today";
}

/** Karta harmonogramu (widok tygodnia) — neutralna; pilność niesie tylko etykieta terminu. */
export function urgentCardClassName(tone: UrgentCardTone | boolean = "today") {
  void tone;
  return cn(
    surfaceCardClass,
    "shadow-[var(--shadow-card)] transition-[border-color,box-shadow,background-color]",
    "hover:border-slate-300/85 hover:shadow-[var(--shadow-card-elevated)]"
  );
}

/** Wiersz listy Dziś — bez własnej karty; wiersze dzieli `divide-y` listy. */
export const urgentListRowClassName =
  "rounded-md transition-colors [@media(hover:hover)_and_(pointer:fine)]:hover:bg-slate-50";

/** Nazwa dostawcy — czytelny link w tonie sekcji. */
export function urgentSupplierNameLinkClass(_tone: UrgentCardTone = "today") {
  return cn(
    "text-left font-semibold tracking-tight transition-colors duration-150",
    "text-slate-900 hover:text-indigo-700"
  );
}

/** Shell footera — delikatna ramka w tonie karty. */
export function urgentFooterShellClass(_tone: UrgentCardTone = "today") {
  return cn(
    "inline-flex h-9 min-h-9 w-full max-w-full items-stretch overflow-hidden rounded-md border bg-white sm:h-7 sm:min-h-7 sm:w-full",
    "border-slate-200"
  );
}

/** Primary „Zamówione” w footerze — zawsze akcent marki. */
export function urgentFooterPrimaryClass(_tone: UrgentCardTone = "today") {
  return cn(
    "flex h-full min-h-0 min-w-0 flex-1 items-center justify-center whitespace-nowrap rounded-none rounded-l-md border-0 px-2 text-[12px] font-semibold leading-none text-white shadow-none transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50",
    "bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800"
  );
}

/** Segment Przesuń w footerze — rozciąga się jak Uzupełniające w prośbach. */
export const urgentFooterShiftSegmentClass =
  "flex h-full min-h-0 min-w-0 flex-1 items-center justify-center whitespace-nowrap rounded-none border-0 border-l border-slate-200/90 px-2 text-[12px] font-medium leading-none text-slate-700 shadow-none transition-colors duration-150 hover:bg-slate-50";

/** Treść karty — bez prawej szyny akcji (akcje w footerze). */
export const urgentCardBodyClass = "px-2.5 py-1.5 sm:px-3";

/** Footer karty — padding; widoczność steruje ProcurementRequestActionsFooter. */
export const urgentCardFooterClass = "px-2.5 py-1 sm:px-3";

export function urgentGroupHeadingClassName(isOverdue = false) {
  return cn(
    "shrink-0 text-sm font-semibold",
    isOverdue ? "text-amber-800" : "text-slate-700"
  );
}

export function urgentGroupDividerClassName(isOverdue = false) {
  void isOverdue;
  return "h-px flex-1 bg-slate-200";
}

export function urgentStatusBadgeVariant(
  isOverdue: boolean
): "warning" | "info" {
  return isOverdue ? "warning" : "info";
}

/** Trailing w nagłówku karty — jak PlannedOrderDateMeta (panel), zamiast badge „Na dziś”. */
export type UrgentScheduleDateMetaModel = {
  caption: string;
  label: string;
  title: string;
  captionClass: string;
  labelClass: string;
};

export function buildUrgentScheduleDateMeta(input: {
  tone: UrgentCardTone;
  dateLabel: string;
}): UrgentScheduleDateMetaModel {
  if (input.tone === "overdue") {
    return {
      caption: "Termin",
      label: input.dateLabel,
      title: `Termin planowy minął ${input.dateLabel}`,
      captionClass: deliveryMetaTypography.captionOverdue,
      labelClass: "text-amber-900",
    };
  }
  return {
    caption: "Termin",
    label: "Dziś",
    title: `Planowe zamówienie na dziś (${input.dateLabel})`,
    captionClass: deliveryMetaTypography.captionAvailable,
    labelClass: "text-sky-900",
  };
}

export function urgentScheduleDateMetaClassName(className?: string) {
  return cn("shrink-0 text-right leading-none", className);
}

export function urgentScheduleDateLabelClassName(labelClass: string) {
  return cn(
    panelTypography.caption,
    "ml-1.5 whitespace-nowrap font-semibold tabular-nums",
    labelClass
  );
}
