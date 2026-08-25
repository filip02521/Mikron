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

/** Karta harmonogramu — ton pilności bez lewego paska (jak prośby: body + footer). */
export function urgentCardClassName(tone: UrgentCardTone | boolean = "today") {
  const isOverdue = tone === true || tone === "overdue";
  return cn(
    surfaceCardClass,
    "shadow-[var(--shadow-card)] transition-[border-color,box-shadow,background-color]",
    isOverdue
      ? "border-amber-200/85 bg-amber-50/25 hover:border-amber-200/95 hover:shadow-[var(--shadow-card-elevated)]"
      : "border-sky-200/75 bg-sky-50/15 hover:border-sky-200/90 hover:shadow-[var(--shadow-card-elevated)]"
  );
}

/** Nazwa dostawcy — czytelny link w tonie sekcji. */
export function urgentSupplierNameLinkClass(tone: UrgentCardTone = "today") {
  return cn(
    "text-left font-semibold tracking-tight transition-colors duration-150",
    tone === "overdue"
      ? "text-amber-950 hover:text-amber-800"
      : "text-sky-950 hover:text-sky-800"
  );
}

/** Shell footera — delikatna ramka w tonie karty. */
export function urgentFooterShellClass(tone: UrgentCardTone = "today") {
  return cn(
    "inline-flex h-7 min-h-7 w-full max-w-full items-stretch overflow-hidden rounded-md border bg-white sm:w-full",
    tone === "overdue" ? "border-amber-200/75" : "border-sky-200/75"
  );
}

/** Primary „Zamówione” w footerze — amber zaległe / indigo na dziś. */
export function urgentFooterPrimaryClass(tone: UrgentCardTone = "today") {
  return cn(
    "flex h-full min-h-0 min-w-0 flex-1 items-center justify-center whitespace-nowrap rounded-none rounded-l-md border-0 px-2 text-[12px] font-semibold leading-none text-white shadow-none transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50",
    tone === "overdue"
      ? "bg-amber-600 hover:bg-amber-700 active:bg-amber-800"
      : "bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800"
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
    "shrink-0 text-xs font-semibold uppercase tracking-wide",
    isOverdue ? "text-amber-800/80" : "text-sky-800/70"
  );
}

export function urgentGroupDividerClassName(isOverdue = false) {
  return cn("h-px flex-1", isOverdue ? "bg-amber-200/70" : "bg-sky-200/60");
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
