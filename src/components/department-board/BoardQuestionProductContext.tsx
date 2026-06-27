import { IconPackage } from "@/components/icons/StrokeIcons";
import {
  boardQuestionHasProduct,
  boardQuestionProductLabel,
  boardQuestionProductMetaLines,
  type BoardQuestionProductFields,
} from "@/lib/department-board/question-product";
import { boardQuestionProductContextClass } from "@/lib/department-board/department-board-thread-styles";
import { DEPARTMENT_BOARD_QUESTIONS_FORM } from "@/lib/department-board/copy";
import { cn } from "@/lib/cn";

export function BoardQuestionProductContext({
  product,
  className,
}: {
  product: Partial<BoardQuestionProductFields>;
  className?: string;
}) {
  if (!boardQuestionHasProduct(product)) return null;

  const label = boardQuestionProductLabel(product);
  const meta = boardQuestionProductMetaLines(product);

  return (
    <div className={cn(boardQuestionProductContextClass, className)}>
      <div className="flex items-start gap-2.5">
        <IconPackage size={16} className="mt-0.5 shrink-0 text-indigo-600" aria-hidden />
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-indigo-700/90">
            {DEPARTMENT_BOARD_QUESTIONS_FORM.productContextLabel}
          </p>
          <p className="mt-0.5 text-sm font-medium leading-snug text-slate-900">{label}</p>
          {meta.length ? (
            <p className="mt-1 text-xs leading-relaxed text-slate-600">{meta.join(" · ")}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
