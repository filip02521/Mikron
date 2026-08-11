import { describe, expect, it } from "vitest";
import {
  procurementBoardAnnouncementHref,
  procurementBoardQuestionHref,
  procurementBoardQuestionsListHref,
  salesBoardAnnouncementHref,
  salesBoardQuestionHref,
} from "./department-board-shared";

describe("salesBoardAnnouncementHref", () => {
  it("otwiera /moje na konkretnym ogłoszeniu", () => {
    expect(salesBoardAnnouncementHref("abc-123")).toBe("/moje?ogloszenie=abc-123");
  });
});

describe("salesBoardQuestionHref", () => {
  it("otwiera /tablica na konkretnym pytaniu", () => {
    expect(salesBoardQuestionHref("q-1")).toBe("/tablica?watek=q-1");
  });
});

describe("procurementBoardAnnouncementHref", () => {
  it("otwiera tablicę zakupów na konkretnym ogłoszeniu", () => {
    expect(procurementBoardAnnouncementHref("abc-123")).toBe(
      "/zakupy/tablica?widok=ogloszenia&watek=abc-123"
    );
  });
});

describe("procurementBoardQuestionHref", () => {
  it("otwiera tablicę zakupów na konkretnym pytaniu", () => {
    expect(procurementBoardQuestionHref("q-1")).toBe(
      "/zakupy/tablica?widok=pytania&watek=q-1"
    );
  });
});

describe("procurementBoardQuestionsListHref", () => {
  it("otwiera widok pytań na tablicy zakupów", () => {
    expect(procurementBoardQuestionsListHref()).toBe("/zakupy/tablica?widok=pytania");
  });
});
