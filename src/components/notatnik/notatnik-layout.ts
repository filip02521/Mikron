import { cn } from "@/lib/cn";
import { controlFocusClass, salesPageShellClass, surfaceCardClass } from "@/lib/ui/ontime-theme";
import { mojeShipmentListClass } from "@/lib/ui/moje-shipment-row-styles";

/** Domyślna szerokość stron handlowca (= {@link salesPageShellClass}). */
export const NOTATNIK_PAGE_CLASS = salesPageShellClass;

/** Siatka 2 kolumn — przewidywalny drag & drop (bez CSS columns). */
export const NOTATNIK_NOTES_GRID_CLASS = "grid grid-cols-2 gap-2";

/** Lista ZK — ten sam wzorzec co /moje (divide-y, bez odstępów). */
export const NOTATNIK_ZK_LIST_CLASS = mojeShipmentListClass;

export function zkWatchRowClass({
  followUpDue,
  archived,
  orderDelivered,
}: {
  followUpDue?: boolean;
  archived?: boolean;
  /** Wszystkie pozycje towarowe dopasowane do dostarczonych prośb. */
  orderDelivered?: boolean;
}): string {
  const accent = archived
    ? "border-l-slate-300"
    : followUpDue
      ? "border-l-violet-500"
      : orderDelivered
        ? "border-l-emerald-500"
        : "border-l-amber-400";

  return cn(
    "border-l-[3px] bg-white transition-colors",
    accent,
    !archived && "hover:bg-slate-50/50"
  );
}

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
