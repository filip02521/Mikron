import { describe, expect, it } from "vitest";
import {
  authorLabelFromProfile,
  boardReplyCountLabel,
  isOperationsAuthorRole,
  questionAuthorLabel,
  formatBoardShortDate,
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

  it("uses sales person name for follow-up replies instead of email local-part", () => {
    expect(
      questionAuthorLabel(
        { name: "Anna Kowalska" },
        { email: "anna.kowalska@firma.pl", role: "sales" }
      )
    ).toBe("Anna Kowalska");
  });

  it("falls back to the profile email when a reply has no sales person card", () => {
    expect(questionAuthorLabel(null, { email: "anna.kowalski@firma.pl", role: "sales" })).toBe(
      "anna.kowalski"
    );
  });

  it("falls back to Handlowiec when a reply has no email", () => {
    expect(questionAuthorLabel({ name: "   " }, { email: null, role: "sales" })).toBe("Handlowiec");
  });

  it("formats reply count in Polish", () => {
    expect(boardReplyCountLabel(1)).toBe("1 odpowiedź");
    expect(boardReplyCountLabel(2)).toBe("2 odpowiedzi");
    expect(boardReplyCountLabel(5)).toBe("5 odpowiedzi");
  });
});

describe("formatBoardShortDate", () => {
  const now = new Date("2026-10-03T19:00:00Z"); // 21:00 w Warszawie

  it("dziś → godzina, wczoraj → „wczoraj”", () => {
    expect(formatBoardShortDate("2026-10-03T12:05:00Z", now)).toBe("14:05");
    expect(formatBoardShortDate("2026-10-02T08:00:00Z", now)).toBe("wczoraj");
  });

  it("ten rok → dzień i miesiąc; starsze → z rokiem; granica doby wg Warszawy", () => {
    expect(formatBoardShortDate("2026-09-03T10:00:00Z", now)).toBe("3 wrz");
    expect(formatBoardShortDate("2025-12-24T10:00:00Z", now)).toBe("24 gru 2025");
    // 22:30 UTC 2 paź = 00:30 3 paź w Warszawie → dziś
    expect(formatBoardShortDate("2026-10-02T22:30:00Z", now)).toBe("00:30");
  });
});
