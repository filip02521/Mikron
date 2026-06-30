/**
 * Tokeny wizualne zębów w formularzu prośby — spójne z ProsbaTeethExemptHint i banerami stanu.
 */

export const teethProsbaStatusRowClass =
  "flex items-start gap-2.5 rounded-md border px-3 py-2.5";

export const teethProsbaShellClass = "border-violet-200/90 bg-violet-50/70";
export const teethProsbaShellIncompleteClass = "border-amber-200/90 bg-amber-50/70";

export const teethProsbaTitleClass = "text-xs font-semibold leading-snug text-violet-950";
export const teethProsbaDetailClass = "mt-0.5 text-xs leading-relaxed text-violet-900/90";
export const teethProsbaIconClass = "mt-0.5 shrink-0 text-violet-700";

export const teethProsbaIncompleteTitleClass = "text-xs font-semibold leading-snug text-amber-950";
export const teethProsbaIncompleteDetailClass = "mt-0.5 text-xs leading-relaxed text-amber-900/90";
export const teethProsbaIncompleteIconClass = "mt-0.5 shrink-0 text-amber-700";

/** Chip pozycji listy — jak badge „Zęby” w zwiniętej pozycji. */
export const teethProsbaChipClass =
  "inline-flex max-w-full items-center rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-medium leading-snug text-violet-950 ring-1 ring-violet-200/80";

export const teethProsbaChipCountClass = "font-semibold tabular-nums text-violet-800";

export const teethProsbaSummaryPanelClass =
  "overflow-hidden rounded-md border border-violet-200/90 bg-violet-50/70";

export const teethProsbaSummaryHeaderClass =
  "flex flex-wrap items-center justify-between gap-2 border-b border-violet-100/90 px-3 py-2.5";

export const teethProsbaSummaryRowClass =
  "flex items-start gap-2.5 border-b border-violet-100/60 px-3 py-2.5 last:border-b-0";

/** Pole ilości tylko do odczytu — subtelne, bez osobnej palety fioletowej. */
export const teethProsbaQuantityInputClass =
  "bg-slate-50/90 text-slate-800";
