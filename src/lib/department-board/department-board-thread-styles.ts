import { cn } from "@/lib/cn";
import { salesTypography } from "@/lib/ui/ontime-theme";

/** Etykieta autora odpowiedzi zakupów w wątku pytań. */
export const BOARD_PROCUREMENT_AUTHOR_LABEL = "Dział zakupów";

export function boardQuestionRowClass(opts: {
  unseen: boolean;
  open: boolean;
  expanded: boolean;
}): string {
  return cn(
    "border-l-[3px] transition-colors duration-150",
    opts.unseen
      ? "border-l-sky-500 bg-sky-50/25"
      : opts.open
        ? "border-l-amber-400"
        : "border-l-slate-200",
    opts.expanded
      ? "bg-slate-50/40"
      : opts.unseen
        ? "hover:bg-sky-50/35"
        : "bg-white hover:bg-slate-50/50"
  );
}

export const boardQuestionUnseenDotClass = "h-2 w-2 shrink-0 rounded-full bg-sky-500";

export const boardAwaitingReplyClass = cn(
  salesTypography.rowMeta,
  "italic text-slate-400"
);
