import { cn } from "@/lib/cn";
import { salesTypography } from "@/lib/ui/ontime-theme";

/** Etykieta autora odpowiedzi zakupów w wątku pytań. */
export const BOARD_PROCUREMENT_AUTHOR_LABEL = "Dział zakupów";

/** Lista wątków pytań — osobny wzorzec od listy zamówień w /moje. */
export const boardQuestionListClass =
  "divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200/90 bg-white shadow-sm";

export function boardQuestionRowClass(opts: {
  unseen: boolean;
  open: boolean;
  expanded: boolean;
}): string {
  return cn(
    "border-l-[3px] transition-colors duration-150",
    opts.unseen
      ? "border-l-indigo-500 bg-indigo-50/20"
      : opts.open
        ? "border-l-amber-400"
        : "border-l-slate-200",
    opts.expanded
      ? "bg-slate-50/50"
      : opts.unseen
        ? "hover:bg-indigo-50/30"
        : "bg-white hover:bg-slate-50/50",
    opts.unseen && !opts.expanded && "ring-1 ring-inset ring-indigo-200/80"
  );
}

export const boardQuestionUnseenDotClass = "h-2 w-2 shrink-0 rounded-full bg-indigo-500";

export function boardQuestionStatusBadgeClass(opts: {
  unseen: boolean;
  open: boolean;
}): string {
  return cn(
    "inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold leading-none",
    opts.open
      ? "bg-amber-100 text-amber-900"
      : opts.unseen
        ? "bg-indigo-100 text-indigo-900"
        : "bg-slate-100 text-slate-600"
  );
}

export const boardQuestionPreviewClass = cn(
  salesTypography.rowBody,
  "block truncate italic text-slate-500"
);

export const boardQuestionProductChipClass =
  "inline-flex max-w-full items-center gap-1.5 rounded-md border border-slate-200/90 bg-slate-100/80 px-2 py-0.5 text-[11px] font-semibold text-slate-700";

export const boardQuestionProductContextClass =
  "rounded-lg border border-slate-200/90 bg-slate-50/80 px-3 py-2.5";

export const boardProcurementReplyShellClass =
  "rounded-lg border border-indigo-200/80 border-l-[3px] border-l-indigo-500 bg-indigo-50/60 px-3.5 py-3";

export const boardQuestionMessageShellClass =
  "rounded-lg border border-amber-200/80 border-l-[3px] border-l-amber-400 bg-amber-50/40 px-3.5 py-3";

export const boardReplyFormShellClass =
  "space-y-2 rounded-lg border border-indigo-100/80 bg-indigo-50/30 px-3.5 py-3";

export const boardAwaitingReplyClass = cn(
  salesTypography.rowMeta,
  "rounded-lg border border-dashed border-slate-200 bg-slate-50/80 px-3.5 py-2.5 italic text-slate-500"
);

export const boardQuestionFabClass =
  "fixed z-50 flex h-12 min-w-12 items-center justify-center gap-2 rounded-full bg-indigo-600 px-4 text-sm font-semibold text-white shadow-lg transition hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600";
