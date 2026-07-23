import type { DepartmentBoardQuestionFilter } from "@/components/department-board/DepartmentBoardSalesChrome";
import type { DepartmentBoardQuestion } from "@/lib/data/department-board";
import { filterDepartmentBoardQuestionsByQuery } from "@/lib/department-board/question-search";

export type DepartmentBoardQuestionFilterContext = {
  unseenIds?: ReadonlySet<string>;
  unseenOwnIds?: ReadonlySet<string>;
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
    case "closed":
      return questions.filter((q) => q.archived_at != null);
    case "unseen":
      return questions.filter((q) => ctx.unseenIds?.has(q.id) ?? false);
    case "own_unseen":
      return questions.filter((q) => ctx.unseenOwnIds?.has(q.id) ?? false);
    case "mine":
      if (!ctx.currentSalesPersonId) return [];
      return questions.filter(
        (q) => q.sales_person_id === ctx.currentSalesPersonId && q.archived_at == null
      );
    default:
      return questions.filter((q) => q.archived_at == null);
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
  const searched = filterDepartmentBoardQuestionsByQuery(questions, opts.search ?? "");
  const statusFiltered = filterDepartmentBoardQuestionsByStatus(
    searched,
    opts.filter,
    opts.ctx ?? {}
  );
  const focusId = opts.focusQuestionId?.trim();
  if (!focusId || statusFiltered.some((q) => q.id === focusId)) {
    return statusFiltered;
  }
  const focused =
    statusFiltered.find((q) => q.id === focusId) ??
    searched.find((q) => q.id === focusId);
  return focused ? [focused, ...statusFiltered] : statusFiltered;
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
  unseenCount: number,
  ownUnseenCount = 0
): DepartmentBoardQuestionFilter {
  if (unseenCount === 0 && filter === "unseen") return "all";
  if (ownUnseenCount === 0 && filter === "own_unseen") return "all";
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
    all: searched.filter((q) => q.archived_at == null).length,
    open: searched.filter((q) => q.status === "open" && q.archived_at == null).length,
    answered: searched.filter((q) => q.status === "answered" && q.archived_at == null).length,
    closed: searched.filter((q) => q.archived_at != null).length,
    unseen: searched.filter((q) => ctx.unseenIds?.has(q.id) ?? false).length,
    own_unseen: searched.filter((q) => ctx.unseenOwnIds?.has(q.id) ?? false).length,
    mine: ctx.currentSalesPersonId
      ? searched.filter((q) => q.sales_person_id === ctx.currentSalesPersonId && q.archived_at == null).length
      : 0,
  };
}
