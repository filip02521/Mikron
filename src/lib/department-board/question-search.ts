import { questionAuthorLabel } from "@/lib/department-board/format";
import type { DepartmentBoardQuestion } from "@/lib/data/department-board";

/** Tekst przeszukiwany w wątku pytania (temat, treść, autor, odpowiedzi). */
export function departmentBoardQuestionSearchHaystack(question: DepartmentBoardQuestion): string {
  const parts = [
    question.title,
    question.body,
    questionAuthorLabel(question.sales_person, question.author),
    ...question.posts.map((post) => post.body),
  ];
  return parts
    .map((part) => part?.trim())
    .filter(Boolean)
    .join("\n")
    .toLowerCase();
}

export function filterDepartmentBoardQuestionsByQuery(
  questions: DepartmentBoardQuestion[],
  query: string
): DepartmentBoardQuestion[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return questions;
  return questions.filter((question) => departmentBoardQuestionSearchHaystack(question).includes(needle));
}
