import type { DepartmentBoardQuestionFilter } from "@/components/department-board/DepartmentBoardSalesChrome";
import type { DepartmentBoardQuestion } from "@/lib/data/department-board";
import { filterDepartmentBoardQuestionsByQuery } from "@/lib/department-board/question-search";

export type DepartmentBoardQuestionFilterContext = {
  unseenIds?: ReadonlySet<string>;
  currentSalesPersonId?: string | null;
};

export function filterDepartmentBoardQuestionsByStatus(
  questions: DepartmentBoardQuestion[],
  filter: DepartmentBoardQuestionFilter,
  ctx: DepartmentBoardQuestionFilterContext = {}
): DepartmentBoardQuestion[] {
  switch (filter) {
    case "open":
      return questions.filter((q) => q.status === "open");
    case "answered":
      return questions.filter((q) => q.status === "answered");
    case "unseen":
      return questions.filter((q) => ctx.unseenIds?.has(q.id) ?? false);
    case "mine":
      if (!ctx.currentSalesPersonId) return [];
      return questions.filter((q) => q.sales_person_id === ctx.currentSalesPersonId);
    default:
      return questions;
  }
}

export function filterDepartmentBoardQuestions(
  questions: DepartmentBoardQuestion[],
  opts: {
    filter: DepartmentBoardQuestionFilter;
    search?: string;
    ctx?: DepartmentBoardQuestionFilterContext;
    focusQuestionId?: string | null;
  }
): DepartmentBoardQuestion[] {
  const statusFiltered = filterDepartmentBoardQuestionsByStatus(
    questions,
    opts.filter,
    opts.ctx ?? {}
  );
  const searched = filterDepartmentBoardQuestionsByQuery(statusFiltered, opts.search ?? "");
  const focusId = opts.focusQuestionId?.trim();
  if (!focusId || searched.some((q) => q.id === focusId)) {
    return searched;
  }
  const focused =
    statusFiltered.find((q) => q.id === focusId) ??
    questions.find((q) => q.id === focusId);
  return focused ? [focused, ...searched] : searched;
}

export function countDepartmentBoardQuestionsByFilter(
  questions: DepartmentBoardQuestion[],
  filter: DepartmentBoardQuestionFilter,
  ctx: DepartmentBoardQuestionFilterContext = {}
): number {
  return filterDepartmentBoardQuestionsByStatus(questions, filter, ctx).length;
}

/** Gdy znikną nieprzeczytane odpowiedzi, filtr „unseen” nie ma sensu. */
export function resolveQuestionFilterAfterUnseenCleared(
  filter: DepartmentBoardQuestionFilter,
  unseenCount: number
): DepartmentBoardQuestionFilter {
  if (unseenCount === 0 && filter === "unseen") return "all";
  return filter;
}

export type DepartmentBoardQuestionFilterCounts = Record<
  DepartmentBoardQuestionFilter,
  number
>;

/** Liczniki chipów w obrębie wyszukiwania (bez aktywnego filtra statusu). */
export function departmentBoardQuestionFilterCounts(
  questions: DepartmentBoardQuestion[],
  opts: {
    search?: string;
    ctx?: DepartmentBoardQuestionFilterContext;
  } = {}
): DepartmentBoardQuestionFilterCounts {
  const searched = filterDepartmentBoardQuestionsByQuery(questions, opts.search ?? "");
  const ctx = opts.ctx ?? {};
  return {
    all: searched.length,
    open: searched.filter((q) => q.status === "open").length,
    answered: searched.filter((q) => q.status === "answered").length,
    unseen: searched.filter((q) => ctx.unseenIds?.has(q.id) ?? false).length,
    mine: ctx.currentSalesPersonId
      ? searched.filter((q) => q.sales_person_id === ctx.currentSalesPersonId).length
      : 0,
  };
}
