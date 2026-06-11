import { cn } from "@/lib/cn";
import { salesTypography } from "@/lib/ui/ontime-theme";

/** Etykieta autora odpowiedzi zakupów w wątku pytań. */
export const BOARD_PROCUREMENT_AUTHOR_LABEL = "Dział zakupów";

export const boardQuestionStatusOpenClass =
  "rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900";

export const boardQuestionStatusAnsweredClass =
  "rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-900";

export const boardQuestionUnseenBadgeClass =
  "rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-800";

export const boardQuestionEmbeddedShellClass = (opts: {
  unseen: boolean;
  open: boolean;
}) =>
  cn(
    "border-l-[3px] bg-white",
    opts.unseen ? "border-l-sky-500 bg-sky-50/25" : "border-l-slate-200",
    opts.open && !opts.unseen && "ring-1 ring-inset ring-amber-100"
  );

export const boardBlockKindLabelClass = cn(
  salesTypography.kindTag,
  "text-slate-500"
);

export const boardAuthorPillClass =
  "rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700";

export const boardProcurementPillClass =
  "rounded-md bg-indigo-100 px-2 py-0.5 text-[11px] font-semibold text-indigo-900";

export const boardQuestionBlockClass =
  "rounded-md border border-amber-100 border-l-[3px] border-l-amber-400 bg-amber-50/40 p-3";

export const boardAnswerBlockClass =
  "rounded-md border border-indigo-100 border-l-[3px] border-l-indigo-500 bg-indigo-50/45 p-3";

export const boardQuestionPreviewPrefixClass = "font-semibold text-amber-800";

export const boardAnswerPreviewPrefixClass = "font-semibold text-indigo-700";

export const boardAwaitingReplyClass = cn(
  salesTypography.rowMeta,
  "rounded-md border border-dashed border-slate-200 bg-slate-50/80 px-3 py-2 text-slate-500"
);
