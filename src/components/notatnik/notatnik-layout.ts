import { cn } from "@/lib/cn";
import { controlFocusClass, surfaceCardClass } from "@/lib/ui/ontime-theme";

/** Domyślna szerokość jak /moje. */
export const NOTATNIK_PAGE_CLASS = "mx-auto w-full max-w-3xl space-y-4";

/** Siatka 2 kolumn — przewidywalny drag & drop (bez CSS columns). */
export const NOTATNIK_NOTES_GRID_CLASS = "grid grid-cols-2 gap-2";

export const NOTATNIK_ZK_LIST_CLASS = "flex flex-col gap-2";

export const NOTATNIK_INPUT_CLASS = cn(
  "h-9 rounded-md border border-slate-200 bg-white px-2.5 text-sm text-slate-900 shadow-sm",
  controlFocusClass
);

export const NOTATNIK_TEXTAREA_CLASS = cn(
  "rounded-md border border-slate-200 bg-white px-2.5 py-2 text-sm leading-snug text-slate-900 shadow-sm",
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
