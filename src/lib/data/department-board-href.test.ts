import { describe, expect, it } from "vitest";
import { procurementBoardAnnouncementHref, procurementBoardQuestionHref, salesBoardAnnouncementHref } from "./department-board";

describe("salesBoardAnnouncementHref", () => {
  it("otwiera /moje na konkretnym ogłoszeniu", () => {
    expect(salesBoardAnnouncementHref("abc-123")).toBe("/moje?ogloszenie=abc-123");
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
