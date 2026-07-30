"use client";

import Link from "next/link";
import { IconChevronRight, IconInfoCircle, IconPackage } from "@/components/icons/StrokeIcons";
import {
  boardQuestionHasProduct,
  boardQuestionProductLabel,
  boardQuestionProductMetaLines,
  type BoardQuestionProductFields,
} from "@/lib/department-board/question-product";
import {
  boardQuestionProductContextBodyClass,
  boardQuestionProductContextClass,
  boardQuestionQuickProsbaCtaClass,
  boardQuestionQuickProsbaHintClass,
  boardQuestionQuickProsbaStripClass,
} from "@/lib/department-board/department-board-thread-styles";
import { DEPARTMENT_BOARD_QUESTIONS_FORM } from "@/lib/department-board/copy";
import {
  buildBoardQuestionProsbaPrefill,
  writeBoardQuestionProsbaPrefill,
} from "@/lib/orders/board-question-prosba-prefill";
import { prosbaHref } from "@/lib/orders/prosba-url";
import { cn } from "@/lib/cn";

export function BoardQuestionProductContext({
  product,
  className,
  showQuickProsba = false,
  threadId,
}: {
  product: Partial<BoardQuestionProductFields>;
  className?: string;
  /** Handlowiec: delikatny CTA do gotowej prośby na ten towar. */
  showQuickProsba?: boolean;
  threadId?: string | null;
}) {
  if (!boardQuestionHasProduct(product)) return null;

  const label = boardQuestionProductLabel(product);
  const meta = boardQuestionProductMetaLines(product);
  const href = showQuickProsba ? prosbaHref({ fromBoard: true }) : null;

  function persistPrefill() {
    const prefill = buildBoardQuestionProsbaPrefill(product, { threadId });
    if (!prefill) return;
    writeBoardQuestionProsbaPrefill(prefill);
  }

  return (
    <div className={cn(boardQuestionProductContextClass, className)}>
      <div className={boardQuestionProductContextBodyClass}>
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-lg bg-slate-100/90 text-slate-500 ring-1 ring-inset ring-slate-200/80">
            <IconPackage size={14} aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              {DEPARTMENT_BOARD_QUESTIONS_FORM.productContextLabel}
            </p>
            <p className="mt-0.5 text-sm font-medium leading-snug text-slate-900">
              {label}
            </p>
            {meta.length ? (
              <p className="mt-1 text-xs leading-relaxed text-slate-600">
                {meta.join(" · ")}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {showQuickProsba && href ? (
        <div className={boardQuestionQuickProsbaStripClass} role="note">
          <p className={cn(boardQuestionQuickProsbaHintClass, "flex gap-2")}>
            <IconInfoCircle
              size={14}
              className="mt-0.5 shrink-0 text-indigo-500/90"
              aria-hidden
            />
            <span>{DEPARTMENT_BOARD_QUESTIONS_FORM.quickProsbaHint}</span>
          </p>
          <Link
            href={href}
            onClick={persistPrefill}
            className={cn(
              "inline-flex w-full shrink-0 items-center justify-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium leading-none transition-colors sm:w-auto",
              boardQuestionQuickProsbaCtaClass
            )}
          >
            {DEPARTMENT_BOARD_QUESTIONS_FORM.quickProsbaCta}
            <IconChevronRight size={13} className="opacity-80" aria-hidden />
          </Link>
        </div>
      ) : null}
    </div>
  );
}
