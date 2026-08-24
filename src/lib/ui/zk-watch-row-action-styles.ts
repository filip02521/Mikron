import { cn } from "@/lib/cn";
import { buttonPrimaryClass, panelToolbarIconButtonClass, salesTypography } from "@/lib/ui/ontime-theme";

/** Stała wysokość wszystkich kontrolek w pasku akcji wiersza ZK. */
export const zkWatchRowActionHeightClass = "h-8";

/** Kontener akcji po prawej stronie wiersza ZK. */
export const zkWatchRowActionBarClass = "flex items-center justify-end gap-1.5";

const zkWatchRowActionTextBaseClass = cn(
  "inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 font-medium transition-colors",
  "rounded-md leading-none text-[0.6875rem] sm:text-xs",
  "disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50",
  "aria-disabled:pointer-events-none aria-disabled:opacity-50",
  zkWatchRowActionHeightClass,
  "px-2.5"
);

/** Główne CTA prośby (Utwórz / Uzupełnij). */
export const zkWatchRowActionPrimaryClass = cn(
  zkWatchRowActionTextBaseClass,
  buttonPrimaryClass,
  "shadow-sm"
);

/** Drugorzędne CTA (Otwórz prośbę, uzupełnij zęby). */
export const zkWatchRowActionSecondaryClass = cn(
  zkWatchRowActionTextBaseClass,
  "border border-slate-200/90 bg-white text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
);

/** Status pokrycia prośby (Obsłużone, Na regale itd.) — ten sam kształt co przyciski. */
export const zkWatchRowActionStatusClass = cn(
  "inline-flex shrink-0 items-center gap-1 rounded-md font-semibold ring-1 ring-inset",
  salesTypography.kindTag,
  zkWatchRowActionHeightClass,
  "px-2 text-[0.6875rem] sm:text-xs"
);

/** Ikona ⋮, kalendarz itd. — kwadrat dopasowany do wysokości CTA tekstowych. */
export const zkWatchRowActionIconClass = cn(
  panelToolbarIconButtonClass,
  "relative h-8 w-8 shrink-0"
);

export function zkWatchRowFollowUpIconClass({
  hasFollowUp,
  followUpDue,
  open,
}: {
  hasFollowUp: boolean;
  followUpDue: boolean;
  open?: boolean;
}): string {
  return cn(
    zkWatchRowActionIconClass,
    !hasFollowUp &&
      "border-dashed border-slate-200/90 bg-slate-50/50 text-slate-400 shadow-none hover:border-slate-300 hover:bg-slate-100/70 hover:text-slate-600",
    hasFollowUp &&
      !followUpDue &&
      "border-violet-200/90 bg-violet-50 text-violet-700 hover:border-violet-300 hover:bg-violet-100/80 hover:text-violet-800",
    followUpDue &&
      "border-amber-300/90 bg-amber-50 text-amber-800 hover:border-amber-400 hover:bg-amber-100/80 hover:text-amber-900",
    open &&
      (hasFollowUp
        ? "ring-2 ring-indigo-100/90 ring-offset-1"
        : "border-indigo-300 bg-indigo-50 text-indigo-700")
  );
}
