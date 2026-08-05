/**
 * Wspólne tokeny chipów statusu w panelu dziennym (flagi + urlop dostawcy).
 * Flaga = akcja ops; urlop = stan systemu (read-only).
 */

export const procurementStatusChipBaseClass =
  "inline-flex h-5 max-w-full shrink-0 items-center gap-1 rounded-md px-1.5 text-[10px] font-semibold leading-none tracking-tight ring-1 ring-inset transition-colors";

export const procurementStatusChipInteractiveClass =
  "cursor-pointer hover:brightness-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-indigo-400/40 active:brightness-[0.95]";

export const procurementStatusChipDisabledClass = "cursor-not-allowed opacity-55";

/** Filtr sekcji — pasek pod nagłówkiem. */
export const procurementListFilterBarClass =
  "flex flex-col gap-1 border-b border-slate-100/90 bg-gradient-to-b from-slate-50/90 via-slate-50/40 to-white/30 px-2.5 py-2 sm:px-3";

export const procurementListFilterTrackClass =
  "relative flex max-w-full flex-nowrap items-center gap-1 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

/** Fade hint — więcej chipów poza viewportem. */
export const procurementListFilterTrackFadeClass =
  "pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-slate-50 via-slate-50/85 to-transparent sm:w-10";

export const procurementListFilterChipClass =
  "inline-flex h-7 shrink-0 items-center gap-1 rounded-md border px-2 text-[11px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/20";

export const procurementListFilterCountClass =
  "tabular-nums text-[10px] font-semibold opacity-70";

export const procurementListFilterCountSelectedClass = "opacity-90";

export const procurementListFilterCountEmptyClass = "opacity-40";

export const procurementListFilterChipIdleClass =
  "border-slate-200/90 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800";

export const procurementListFilterChipSelectedClass =
  "border-indigo-400/90 bg-gradient-to-b from-indigo-50 to-white text-indigo-950 shadow-sm ring-1 ring-indigo-200/50";

export const procurementListFilterChipVacationIdleClass =
  "border-amber-200/80 bg-amber-50/40 text-amber-900/80 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-950";

export const procurementListFilterChipVacationSelectedClass =
  "border-amber-400/90 bg-gradient-to-b from-amber-50 to-white text-amber-950 shadow-sm ring-1 ring-amber-200/60";
