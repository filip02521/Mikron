import { describe, expect, it } from "vitest";
import type { DepartmentBoardQuestion } from "@/lib/data/department-board";
import {
  departmentBoardQuestionSearchHaystack,
  filterDepartmentBoardQuestionsByQuery,
} from "./question-search";

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
    closed_by: null,
    created_at: "",
    updated_at: "",
    sales_person: { id: "sp1", name: "Anna Kowalska" },
    author: { email: "anna@firma.pl", role: "sales" },
    posts: [],
    ...partial,
  };
}

describe("filterDepartmentBoardQuestionsByQuery", () => {
  const questions = [
    testQuestion({ id: "q1", title: "Termin dostawy Straumann", body: "Kiedy będzie towar?" }),
    testQuestion({
      id: "q2",
      title: "Cennik Dentsply",
      body: "Proszę o aktualizację.",
      sales_person: { id: "sp2", name: "Jan Nowak" },
      posts: [
        {
          id: "p1",
          thread_id: "q2",
          body: "Wyślemy PDF jutro.",
          created_by: "u2",
          created_at: "",
          author: { email: "zakupy@firma.pl", role: "zakupy" },
        },
      ],
    }),
  ];

  it("zwraca pełną listę przy pustym zapytaniu", () => {
    expect(filterDepartmentBoardQuestionsByQuery(questions, "  ")).toHaveLength(2);
  });

  it("szuka po tytule i treści pytania", () => {
    expect(filterDepartmentBoardQuestionsByQuery(questions, "straumann")).toHaveLength(1);
    expect(filterDepartmentBoardQuestionsByQuery(questions, "aktualizację")[0]?.id).toBe("q2");
  });

  it("szuka po autorze i treści odpowiedzi", () => {
    expect(filterDepartmentBoardQuestionsByQuery(questions, "jan nowak")).toHaveLength(1);
    expect(filterDepartmentBoardQuestionsByQuery(questions, "pdf")).toHaveLength(1);
  });

  it("szuka po symbolu i nazwie produktu", () => {
    const withProduct = testQuestion({
      id: "q3",
      title: "Stan magazynowy",
      body: "Czy mamy na stanie?",
      product_symbol: "606402",
      product_name: "Straumann implant",
    });
    expect(filterDepartmentBoardQuestionsByQuery([withProduct], "606402")).toHaveLength(1);
    expect(filterDepartmentBoardQuestionsByQuery([withProduct], "straumann implant")).toHaveLength(1);
  });

  it("buduje haystack z autorem i odpowiedziami", () => {
    const haystack = departmentBoardQuestionSearchHaystack(questions[1]!);
    expect(haystack).toContain("jan nowak");
    expect(haystack).toContain("wyślemy pdf jutro");
  });
});

describe("filterDepartmentBoardQuestionsByQuery with status subset", () => {
  const questions = [
    testQuestion({ id: "q-open", title: "Otwarte", body: "czeka", status: "open" }),
    testQuestion({ id: "q-done", title: "Zamknięte", body: "gotowe", status: "answered" }),
  ];

  it("filtruje tylko w obrębie przekazanej listy statusu", () => {
    const openOnly = questions.filter((q) => q.status === "open");
    expect(filterDepartmentBoardQuestionsByQuery(openOnly, "gotowe")).toHaveLength(0);
    expect(filterDepartmentBoardQuestionsByQuery(openOnly, "czeka")).toHaveLength(1);
  });
});
