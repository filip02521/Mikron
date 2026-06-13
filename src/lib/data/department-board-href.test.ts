import { describe, expect, it } from "vitest";
import { salesBoardAnnouncementHref, procurementBoardAnnouncementHref } from "./department-board";

describe("salesBoardAnnouncementHref", () => {
  it("otwiera tablicę na konkretnym ogłoszeniu", () => {
    expect(salesBoardAnnouncementHref("abc-123")).toBe(
      "/tablica?widok=ogloszenia&watek=abc-123"
    );
  });
});

describe("procurementBoardAnnouncementHref", () => {
  it("otwiera tablicę zakupów na konkretnym ogłoszeniu", () => {
    expect(procurementBoardAnnouncementHref("abc-123")).toBe(
      "/zakupy/tablica?widok=ogloszenia&watek=abc-123"
    );
  });
});
