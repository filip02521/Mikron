import { describe, expect, it } from "vitest";
import type { DepartmentBoardThreadRow } from "@/lib/data/department-board";
import { filterDepartmentBoardAnnouncementsByQuery } from "./announcement-search";

function testAnnouncement(
  partial: Partial<DepartmentBoardThreadRow> & Pick<DepartmentBoardThreadRow, "id" | "title" | "body">
): DepartmentBoardThreadRow {
  return {
    kind: "announcement",
    status: "open",
    created_by: "u1",
    sales_person_id: null,
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
    author: { email: "zakupy@firma.pl", role: "zakupy" },
    ...partial,
  };
}

describe("filterDepartmentBoardAnnouncementsByQuery", () => {
  const items = [
    testAnnouncement({ id: "a1", title: "Zmiana procedury", body: "Od poniedziałku…" }),
    testAnnouncement({ id: "a2", title: "Urlop", body: "Biuro zamknięte" }),
  ];

  it("zwraca pełną listę przy pustym zapytaniu", () => {
    expect(filterDepartmentBoardAnnouncementsByQuery(items, " ")).toHaveLength(2);
  });

  it("szuka po tytule i treści", () => {
    expect(filterDepartmentBoardAnnouncementsByQuery(items, "procedur")).toHaveLength(1);
    expect(filterDepartmentBoardAnnouncementsByQuery(items, "urlop")[0]?.id).toBe("a2");
  });
});
