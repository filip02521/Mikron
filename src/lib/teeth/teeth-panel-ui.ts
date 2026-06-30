/** Tokeny wizualne panelu zębów (/zeby) — neutralna paleta, jeden akcent na akcje primary. */

export const teethPanelSupplierCardClass =
  "overflow-hidden rounded-md border border-slate-200/80 bg-[var(--card)] shadow-sm";

export const teethPanelSupplierHeaderClass =
  "flex flex-col gap-2 border-b border-slate-200/80 bg-white py-2.5 sm:flex-row sm:items-center sm:justify-between";

export const teethPanelOrderRowClass =
  "group/panelRow border-b border-slate-100 px-3 py-3 transition-colors last:border-b-0 hover:bg-slate-50/50 sm:px-4 lg:px-5";

export const teethPanelOrderRowCompactClass =
  "group/panelRow border-b border-slate-100 px-3 py-2 transition-colors last:border-b-0 hover:bg-slate-50/50 sm:px-4 lg:px-5";

export const teethPanelOrderRowSelectedClass =
  "bg-slate-50/90 ring-1 ring-inset ring-slate-200/80 hover:bg-slate-50";

export const teethPanelSpecInsetClass =
  "rounded-md border border-slate-200/80 bg-slate-50/40 px-2.5 py-2 sm:px-3";

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

export const teethPanelFiltersBarClass =
  "-mx-3 -mt-3 border-b border-slate-200/80 bg-slate-50/50 px-3 py-2.5 sm:-mx-4 sm:px-4 lg:-mx-5 lg:px-5";
