import { describe, expect, it } from "vitest";
import type { DepartmentBoardQuestion } from "@/lib/data/department-board";
import {
  countDepartmentBoardQuestionsByFilter,
  departmentBoardQuestionFilterCounts,
  filterDepartmentBoardQuestions,
  filterDepartmentBoardQuestionsByStatus,
  resolveQuestionFilterAfterUnseenCleared,
} from "./question-filters";

function testQuestion(
  partial: Partial<DepartmentBoardQuestion> & Pick<DepartmentBoardQuestion, "id" | "title" | "body">
): DepartmentBoardQuestion {
  return {
    kind: "question",
    status: "open",
    created_by: "u1",
    sales_person_id: "sp1",
    color: "default",
    pinned: false,
    published_at: "",
    product_symbol: null,
    product_name: null,
    subiekt_tw_id: null,
    mikran_code: null,
    expires_at: null,
    answered_at: null,
    archived_at: null,
    created_at: "",
    updated_at: "",
    sales_person: { id: "sp1", name: "Anna" },
    author: { email: "anna@firma.pl", role: "sales" },
    posts: [],
    ...partial,
  };
}

const questions = [
  testQuestion({ id: "q1", title: "Moje otwarte", body: "a", sales_person_id: "sp1" }),
  testQuestion({
    id: "q2",
    title: "Cudze odpowiedziane",
    body: "b",
    status: "answered",
    sales_person_id: "sp2",
  }),
  testQuestion({ id: "q3", title: "Nowa odp", body: "c", status: "answered", sales_person_id: "sp1" }),
];

describe("filterDepartmentBoardQuestionsByStatus", () => {
  it("filtruje otwarte i odpowiedziane", () => {
    expect(filterDepartmentBoardQuestionsByStatus(questions, "open")).toHaveLength(1);
    expect(filterDepartmentBoardQuestionsByStatus(questions, "answered")).toHaveLength(2);
  });

  it("filtruje nieprzeczytane odpowiedzi", () => {
    const unseen = new Set(["q3"]);
    expect(
      filterDepartmentBoardQuestionsByStatus(questions, "unseen", { unseenIds: unseen })
    ).toHaveLength(1);
  });

  it("filtruje tylko moje pytania", () => {
    expect(
      filterDepartmentBoardQuestionsByStatus(questions, "mine", { currentSalesPersonId: "sp1" })
    ).toHaveLength(2);
  });
});

describe("filterDepartmentBoardQuestions", () => {
  it("dokleja wątek z deep linku na początek listy", () => {
    const result = filterDepartmentBoardQuestions(questions, {
      filter: "open",
      focusQuestionId: "q2",
    });
    expect(result[0]?.id).toBe("q2");
  });

  it("łączy filtr statusu z wyszukiwaniem", () => {
    const result = filterDepartmentBoardQuestions(questions, {
      filter: "answered",
      search: "cudze",
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("q2");
  });
});

describe("countDepartmentBoardQuestionsByFilter", () => {
  it("liczy wyniki filtra", () => {
    expect(countDepartmentBoardQuestionsByFilter(questions, "mine", { currentSalesPersonId: "sp1" })).toBe(
      2
    );
  });
});

describe("resolveQuestionFilterAfterUnseenCleared", () => {
  it("przełącza na wszystkie gdy brak unseen", () => {
    expect(resolveQuestionFilterAfterUnseenCleared("unseen", 0)).toBe("all");
    expect(resolveQuestionFilterAfterUnseenCleared("open", 0)).toBe("open");
    expect(resolveQuestionFilterAfterUnseenCleared("unseen", 2)).toBe("unseen");
  });
});

describe("departmentBoardQuestionFilterCounts", () => {
  it("liczy wyniki w obrębie wyszukiwania", () => {
    const counts = departmentBoardQuestionFilterCounts(questions, {
      search: "cudze",
      ctx: { unseenIds: new Set(["q3"]), currentSalesPersonId: "sp1" },
    });
    expect(counts.all).toBe(1);
    expect(counts.answered).toBe(1);
    expect(counts.unseen).toBe(0);
  });
});
