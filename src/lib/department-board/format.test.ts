import { describe, expect, it } from "vitest";
import {
  authorLabelFromProfile,
  boardReplyCountLabel,
  isOperationsAuthorRole,
  questionAuthorLabel,
} from "@/lib/department-board/format";

describe("department-board format", () => {
  it("detects operations roles", () => {
    expect(isOperationsAuthorRole("zakupy")).toBe(true);
    expect(isOperationsAuthorRole("admin")).toBe(true);
    expect(isOperationsAuthorRole("sales")).toBe(false);
  });

  it("labels operations authors as Zakupy", () => {
    expect(authorLabelFromProfile({ email: "jan@firma.pl", role: "zakupy" })).toBe("Zakupy");
  });

  it("prefers sales person name for questions", () => {
    expect(
      questionAuthorLabel({ name: "Anna K." }, { email: "anna@firma.pl", role: "sales" })
    ).toBe("Anna K.");
  });

  it("formats reply count in Polish", () => {
    expect(boardReplyCountLabel(1)).toBe("1 odpowiedź");
    expect(boardReplyCountLabel(2)).toBe("2 odpowiedzi");
    expect(boardReplyCountLabel(5)).toBe("5 odpowiedzi");
  });
});
