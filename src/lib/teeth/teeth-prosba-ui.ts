/**
 * Tokeny wizualne zębów w formularzu prośby — spójne z ProsbaTeethExemptHint i banerami stanu.
 */

export const teethProsbaStatusRowClass =
  "flex items-start gap-2.5 rounded-md border px-3 py-2.5";

export const teethProsbaShellClass = "border-neutral-200 bg-neutral-50";
export const teethProsbaShellIncompleteClass = "border-amber-200/90 bg-amber-50/70";

export const teethProsbaTitleClass = "text-xs font-semibold leading-snug text-neutral-900";
export const teethProsbaDetailClass = "mt-0.5 text-xs leading-relaxed text-neutral-900";
export const teethProsbaIconClass = "mt-0.5 shrink-0 text-neutral-700";

export const teethProsbaIncompleteTitleClass = "text-xs font-semibold leading-snug text-amber-950";
export const teethProsbaIncompleteDetailClass = "mt-0.5 text-xs leading-relaxed text-amber-900/90";
export const teethProsbaIncompleteIconClass = "mt-0.5 shrink-0 text-amber-700";

/** Chip pozycji listy — jak badge „Zęby” w zwiniętej pozycji. */
export const teethProsbaChipClass =
  "inline-flex max-w-full items-center rounded-md bg-white/80 px-2 py-0.5 text-[11px] font-medium leading-snug text-neutral-900 ring-1 ring-neutral-200";

export const teethProsbaChipCountClass = "font-semibold tabular-nums text-neutral-800";

export const teethProsbaSummaryPanelClass =
  "overflow-hidden rounded-md border border-neutral-200 bg-neutral-50";

export const teethProsbaSummaryHeaderClass =
  "flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 px-3 py-2.5";

export const teethProsbaSummaryRowClass =
  "flex items-start gap-2.5 border-b border-neutral-100 px-3 py-2.5 last:border-b-0";

/** Pole ilości tylko do odczytu — subtelne, bez osobnej palety fioletowej. */
export const teethProsbaQuantityInputClass =
  "bg-slate-50/90 text-slate-800";
