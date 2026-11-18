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

function productRowText(product: Partial<BoardQuestionProductFields>) {
  const label = boardQuestionProductLabel(product);
  // Symbol jest już w nazwie („302801 - …”) — nie powtarzamy go pod spodem.
  const meta = boardQuestionProductMetaLines(product).filter(
    (line) => !(line.startsWith("Symbol: ") && label.includes(line.slice("Symbol: ".length)))
  );
  return { label, meta };
}

/** Produkty pytania na Tablicy: pierwszy z kolumn wątku, kolejne z `extraProducts`. */
export function BoardQuestionProductContext({
  products,
  className,
  showQuickProsba = false,
  threadId,
}: {
  products: Partial<BoardQuestionProductFields>[];
  className?: string;
  /** Handlowiec: link do gotowej prośby na dany towar. */
  showQuickProsba?: boolean;
  threadId?: string | null;
}) {
  const list = products.filter((p) => boardQuestionHasProduct(p));
  if (!list.length) return null;
  const single = list.length === 1;
  const href = showQuickProsba ? prosbaHref({ fromBoard: true }) : null;

  function persistPrefill(product: Partial<BoardQuestionProductFields>) {
    const prefill = buildBoardQuestionProsbaPrefill(product, { threadId });
    if (!prefill) return;
    writeBoardQuestionProsbaPrefill(prefill);
  }

  const ctaClass = cn(
    "inline-flex w-full shrink-0 items-center justify-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium leading-none transition-colors sm:w-auto",
    boardQuestionQuickProsbaCtaClass
  );

  return (
    <div className={cn(boardQuestionProductContextClass, className)}>
      <div className={boardQuestionProductContextBodyClass}>
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-lg bg-slate-100/90 text-slate-500 ring-1 ring-inset ring-slate-200/80">
            <IconPackage size={14} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[0.6875rem] font-semibold text-slate-500">
              {single
                ? DEPARTMENT_BOARD_QUESTIONS_FORM.productContextLabel
                : `${DEPARTMENT_BOARD_QUESTIONS_FORM.productsContextLabel} (${list.length})`}
            </p>
            <ul className={cn(!single && "mt-1 divide-y divide-slate-200/70")}>
              {list.map((product, i) => {
                const { label, meta } = productRowText(product);
                return (
                  <li
                    key={`${product.subiekt_tw_id ?? ""}-${label}-${i}`}
                    className={cn(!single && "flex flex-col gap-1.5 py-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3")}
                  >
                    <div className="min-w-0">
                      <p className="mt-0.5 text-sm font-medium leading-snug text-slate-900">{label}</p>
                      {meta.length ? (
                        <p className="mt-1 text-xs leading-relaxed text-slate-600">{meta.join(" · ")}</p>
                      ) : null}
                    </div>
                    {!single && href ? (
                      <Link
                        href={href}
                        onClick={() => persistPrefill(product)}
                        className={ctaClass}
                        aria-label={`${DEPARTMENT_BOARD_QUESTIONS_FORM.quickProsbaCta}: ${label}`}
                      >
                        {DEPARTMENT_BOARD_QUESTIONS_FORM.quickProsbaCta}
                        <IconChevronRight size={13} className="opacity-80" aria-hidden />
                      </Link>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>

      {href ? (
        <div className={boardQuestionQuickProsbaStripClass} role="note">
          <p className={cn(boardQuestionQuickProsbaHintClass, "flex gap-2")}>
            <IconInfoCircle
              size={14}
              className="mt-0.5 shrink-0 text-indigo-500/90"
              aria-hidden
            />
            <span>
              {single
                ? DEPARTMENT_BOARD_QUESTIONS_FORM.quickProsbaHint
                : DEPARTMENT_BOARD_QUESTIONS_FORM.quickProsbaHintMany}
            </span>
          </p>
          {single ? (
            <Link href={href} onClick={() => persistPrefill(list[0])} className={ctaClass}>
              {DEPARTMENT_BOARD_QUESTIONS_FORM.quickProsbaCta}
              <IconChevronRight size={13} className="opacity-80" aria-hidden />
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
