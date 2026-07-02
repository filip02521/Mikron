/** Tokeny wizualne panelu zębów (/zeby) — neutralna paleta, jeden akcent na akcje primary. */

export const teethPanelSupplierCardClass =
  "overflow-hidden rounded-md border border-slate-200/80 bg-[var(--card)] shadow-sm";

export const teethPanelSupplierHeaderClass =
  "flex flex-col gap-2 border-b border-slate-200/80 bg-white py-2.5 sm:flex-row sm:items-center sm:justify-between";

export const teethPanelOrderRowIssueClass =
  "border-l-2 border-l-amber-400/90 bg-amber-50/20 hover:bg-amber-50/35";

export const teethPanelOrderRowReadyClass =
  "border-l-2 border-l-emerald-400/75 bg-emerald-50/10 hover:bg-emerald-50/20";

export const teethPanelOrderRowOrderedClass =
  "border-l-2 border-l-sky-400/75 bg-sky-50/10 hover:bg-sky-50/20";

export const teethPanelOrderRowDoneClass =
  "border-l-2 border-l-slate-300/80 bg-slate-50/30 hover:bg-slate-50/50";

export const teethPanelOrderRowClass =
  "group/panelRow border-b border-slate-100 px-3 py-3 transition-colors last:border-b-0 hover:bg-slate-50/50 sm:px-4 lg:px-5";

export const teethPanelOrderRowCompactClass =
  "group/panelRow border-b border-slate-100 px-3 py-2 transition-colors last:border-b-0 hover:bg-slate-50/50 sm:px-4 lg:px-5";

export const teethPanelOrderRowSelectedClass =
  "bg-slate-50/90 ring-1 ring-inset ring-slate-200/80 hover:bg-slate-50";

export const teethPanelSpecInsetClass =
  "rounded-md border border-slate-200/80 bg-slate-50/40 px-2.5 py-2 sm:px-3";

export const teethPanelSpecInsetDenseClass =
  "rounded border border-slate-200/70 bg-slate-50/30 px-2 py-1";

export const teethPanelBatchStripClass =
  "border-b border-slate-200/80 bg-slate-50/40";

export const teethPanelScheduledRowClass =
  "flex flex-col gap-2 border-b border-slate-100 px-3 py-2.5 last:border-b-0 sm:flex-row sm:items-center sm:justify-between sm:px-4 lg:px-5";

export const teethPanelRowActionsClass =
  "flex shrink-0 items-center gap-0.5 sm:opacity-100 [@media(hover:hover)]:opacity-70 [@media(hover:hover)]:group-hover/panelRow:opacity-100";

/** Chip specyfikacji w panelu zakupów — neutralny (formularz prośby zostaje fioletowy). */
export const teethPanelChipClass =
  "inline-flex max-w-full items-center rounded-md bg-white px-2 py-0.5 text-[11px] font-medium leading-snug text-slate-800 ring-1 ring-slate-200/90";

export const teethPanelChipCountClass = "font-semibold tabular-nums text-slate-600";

/** Link / przycisk edycji listy w panelu. */
export const teethPanelEditLinkClass =
  "min-h-8 px-2 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900";

/** Meta w nagłówku grupy dostawcy (cykl, ETA). */
export const teethPanelHeaderMetaClass = "text-xs text-slate-500 tabular-nums";

/** Pusty / niekompletny stan specyfikacji w panelu (neutralny, bez tokenów prośby). */
export const teethPanelIncompleteShellClass =
  "rounded-md border border-amber-200/80 bg-amber-50/40";

export const teethPanelIncompleteTitleClass = "text-xs font-semibold text-amber-900";

export const teethPanelIncompleteDetailClass =
  "text-[11px] leading-relaxed text-amber-800/90";

export const teethPanelSpecIncludedHintClass =
  "rounded-md border border-slate-200/80 bg-white/80 px-2.5 py-1.5 text-xs text-slate-600";

export const teethPanelBatchLineBlockClass =
  "space-y-2 rounded-md border border-slate-200/70 bg-white/60 p-2.5";

export const teethPanelFiltersBarClass =
  "-mx-3 -mt-3 border-b border-slate-200/80 bg-slate-50/50 px-3 py-2.5 sm:-mx-4 sm:px-4 lg:-mx-5 lg:px-5";

/** Sekcja przyjęcia — alias karty panelu zębów. */
export const teethReceiveSupplierSectionClass = teethPanelSupplierCardClass;

export const teethReceiveSupplierHeaderClass = teethPanelSupplierHeaderClass;

export const teethReceiveTableWrapClass = "overflow-x-auto";

export const teethReceiveThClass =
  "sticky top-0 z-[1] whitespace-nowrap bg-slate-50/95 px-2.5 py-2.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 backdrop-blur-sm first:pl-4 last:pr-4";

export const teethReceiveTdClass = "px-2.5 py-2.5 align-middle first:pl-4 last:pr-4";

export const teethReceiveOrderDividerClass = "border-t-2 border-slate-200/90";

export const teethReceiveSalesPersonRowClass = "bg-white";

export const teethReceiveSalesPersonBannerClass =
  "relative flex items-center gap-3 px-4 py-3 sm:px-5";

export const teethReceiveSaveButtonClass =
  "rounded-lg border border-indigo-200 bg-indigo-600 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-50";

export const teethReceiveSectionOutlineButtonClass =
  "rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50";

export const teethReceiveDataRowClass =
  "border-b border-slate-100/90 transition-colors hover:bg-slate-50/60";

export const teethReceiveDataRowActiveClass = "bg-indigo-50/35 hover:bg-indigo-50/45";

export const teethReceiveDataRowDoneClass = "bg-emerald-50/40 hover:bg-emerald-50/50";

export const teethReceiveDataRowPartialClass = "bg-amber-50/20 hover:bg-amber-50/30";

export const teethReceiveDataRowClosedClass = "bg-slate-50/40 text-slate-500 hover:bg-slate-50/50";

export const teethReceiveQtyInputClass =
  "w-12 rounded-md border border-slate-200 bg-white px-1.5 py-1.5 text-center text-xs font-semibold tabular-nums shadow-sm";

export const teethReceiveQtyInputFilledClass =
  "border-indigo-300 bg-indigo-50/80 text-indigo-950";

export const teethReceiveQtyInputDoneClass =
  "border-emerald-300 bg-emerald-50/80 text-emerald-950";

export const teethReceiveManualCellClass =
  "rounded-md border border-amber-200/70 bg-amber-50/35 px-2.5 py-2";

const TEETH_RECEIVE_SALES_PERSON_DOTS = [
  "bg-indigo-500",
  "bg-slate-500",
  "bg-indigo-400",
  "bg-sky-400",
] as const;

export function teethReceiveSalesPersonDotClass(stripeIndex: number): string {
  return TEETH_RECEIVE_SALES_PERSON_DOTS[stripeIndex % TEETH_RECEIVE_SALES_PERSON_DOTS.length]!;
}

export const teethPanelHistoryOrdersListClass =
  "space-y-2 border-t border-slate-200/80 bg-slate-50/40 p-2 sm:p-3";

/** Karta pojedynczego zamówienia w historii — wyraźnie odseparowana od sąsiednich. */
export const teethPanelHistoryOrderCardClass =
  "overflow-hidden rounded-md border border-slate-200 bg-[var(--card)] p-2 shadow-sm ring-1 ring-slate-200/60 sm:p-2.5";

export const teethPanelHistoryOrderCardOrderedClass = "border-l-4 border-l-sky-500";

export const teethPanelHistoryOrderCardPartialClass = "border-l-4 border-l-amber-500";

export const teethPanelHistoryOrderCardDoneClass = "border-l-4 border-l-slate-400";
