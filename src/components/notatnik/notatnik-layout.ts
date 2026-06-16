import { cn } from "@/lib/cn";
import { controlFocusClass, salesPageShellClass, surfaceCardClass } from "@/lib/ui/ontime-theme";
import { mojeShipmentListClass } from "@/lib/ui/moje-shipment-row-styles";

/** Domyślna szerokość stron handlowca (= {@link salesPageShellClass}). */
export const NOTATNIK_PAGE_CLASS = salesPageShellClass;

/** Wewnętrzna tablica karteczek — spójna z panelem Notatnik (indigo / slate). */
export const NOTATNIK_NOTES_WALL_CLASS = cn(
  "overflow-visible rounded-md border border-indigo-100/70",
  "bg-indigo-50/25 bg-[radial-gradient(circle_at_1px_1px,rgba(148,163,184,0.1)_1px,transparent_0)]",
  "bg-[length:18px_18px]",
  "shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)]",
  "px-3 py-4 sm:px-4 sm:py-5"
);

/** Siatka karteczek na tablicy (2 kolumny, duży odstęp na przechylenie). */
export const NOTATNIK_NOTES_GRID_CLASS = "grid grid-cols-2 gap-x-3 gap-y-7 sm:gap-x-4 sm:gap-y-9";

/** Lista ZK — ten sam wzorzec co /moje (divide-y, bez odstępów). */
export const NOTATNIK_ZK_LIST_CLASS = mojeShipmentListClass;

export const NOTATNIK_ZK_ACTIONS_CLASS =
  "grid grid-cols-2 gap-1.5 border-t border-slate-100 pt-2 sm:grid-cols-3";

export const NOTATNIK_ZK_BTN_CLASS = "min-h-11 w-full px-2 text-xs sm:h-8";

export const NOTATNIK_ZK_FOLLOWUP_CLASS =
  "mt-2 space-y-1.5 border-t border-slate-100 pt-2";

export const NOTATNIK_INPUT_CLASS = cn(
  "h-8 rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-900 shadow-sm",
  controlFocusClass
);

export const NOTATNIK_TEXTAREA_CLASS = cn(
  "rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs leading-snug text-slate-900 shadow-sm",
  controlFocusClass
);

export const NOTATNIK_INPUT_NARROW_CLASS = "w-[15rem] max-w-full";

export const NOTATNIK_SEARCH_CLASS = cn(NOTATNIK_INPUT_CLASS, "w-[11rem] max-w-full");

export function notatnikPanelClass(className?: string) {
  return cn(surfaceCardClass, "min-h-0", className);
}

export function notatnikCollapsibleClass(className?: string) {
  return cn(surfaceCardClass, className);
}
