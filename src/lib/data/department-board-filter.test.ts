import { describe, expect, it } from "vitest";
import { activeAnnouncementExpiryOr } from "@/lib/data/department-board";

describe("activeAnnouncementExpiryOr", () => {
  it("owija timestamp ISO w cudzysłowy dla PostgREST", () => {
    const now = "2026-06-09T10:15:30.123Z";
    expect(activeAnnouncementExpiryOr(now)).toBe(
      'expires_at.is.null,expires_at.gt."2026-06-09T10:15:30.123Z"'
    );
  });
});

describe("fetchDepartmentBoard composition", () => {
  it("eksportuje osobne fetch dla pytań i ogłoszeń", async () => {
    const { fetchDepartmentBoardQuestions, fetchDepartmentBoardAnnouncements } =
      await import("@/lib/data/department-board");

    expect(typeof fetchDepartmentBoardQuestions).toBe("function");
    expect(typeof fetchDepartmentBoardAnnouncements).toBe("function");
  });
});
