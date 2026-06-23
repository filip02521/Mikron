import { cn } from "@/lib/cn";
import { salesTypography } from "@/lib/ui/ontime-theme";

export const boardQuestionsSectionClass = "space-y-4";

export const boardQuestionsToolbarShellClass = "space-y-3 border-b border-slate-100 pb-3";

export const boardQuestionsFormShellClass =
  "overflow-hidden rounded-lg border border-indigo-200/80 bg-white shadow-sm";

/** Formularz wewnątrz panelu listy — bez osobnej karty. */
export const boardQuestionsFormEmbeddedShellClass = "border-b border-slate-100 pb-3";

export const boardQuestionsFormHeaderClass =
  "flex items-center gap-2.5 border-b border-indigo-100/90 bg-gradient-to-r from-indigo-50/70 via-indigo-50/30 to-white px-3 py-2.5 sm:px-4";

export const boardQuestionsFormEmbeddedHeaderClass = cn(
  "flex w-full items-center gap-2.5 rounded-lg border border-indigo-200/90",
  "bg-gradient-to-r from-indigo-50/90 via-indigo-50/50 to-white px-3 py-2.5 text-left shadow-sm",
  "transition hover:border-indigo-300 hover:from-indigo-50 hover:shadow",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/25"
);

export const boardQuestionsFormEmbeddedHeaderExpandedClass =
  "rounded-b-none border-b-0 shadow-none hover:shadow-none";

export const boardQuestionsFormEmbeddedTitleClass = "text-sm font-semibold text-indigo-900";

export const boardQuestionsFormEmbeddedExpandBadgeClass =
  "rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-semibold text-indigo-700";

export const boardQuestionsFormBodyClass = "space-y-4 px-3 py-3 sm:px-4 sm:py-4";

export const boardQuestionsFormEmbeddedBodyClass = cn(
  "space-y-3 rounded-b-lg border border-t-0 border-indigo-200/90 bg-white px-3 pb-4 pt-3 sm:px-4"
);

export const boardQuestionsFieldLabelClass =
  "mb-1.5 flex items-center gap-1.5 text-xs font-semibold tracking-tight text-slate-700";

export const boardQuestionsFieldHintClass = cn(salesTypography.sectionHint, "mt-1");

export const boardQuestionsListFooterClass =
  "border-t border-slate-100 bg-slate-50/40 px-3 py-2 text-xs text-slate-500 sm:px-4";

export const boardQuestionRowHeaderClass = "px-3 py-3.5 sm:px-4 sm:py-4";

export const boardQuestionExpandedShellClass =
  "space-y-4 border-t border-slate-100/90 bg-slate-50/30 px-3 pb-4 pt-3.5 sm:px-4 sm:pb-5 sm:pt-4";

export const boardQuestionInlineReplyShellClass =
  "space-y-2.5 border-t border-indigo-100/80 bg-indigo-50/20 px-3 pb-3.5 pt-3 sm:px-4";
