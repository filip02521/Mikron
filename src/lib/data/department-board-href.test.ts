import { describe, expect, it } from "vitest";
import { salesBoardAnnouncementHref } from "./department-board";

describe("salesBoardAnnouncementHref", () => {
  it("otwiera tablicę na konkretnym ogłoszeniu", () => {
    expect(salesBoardAnnouncementHref("abc-123")).toBe(
      "/tablica?widok=ogloszenia&watek=abc-123"
    );
  });
});
