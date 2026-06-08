import { describe, expect, it } from "vitest";
import { sortAnnouncements, sortQuestions } from "@/lib/department-board/sort";

describe("sortAnnouncements", () => {
  it("sorts pinned first, then by published_at desc", () => {
    const rows = [
      { id: "a", pinned: false, published_at: "2026-01-02T10:00:00Z" },
      { id: "b", pinned: true, published_at: "2026-01-01T10:00:00Z" },
      { id: "c", pinned: false, published_at: "2026-01-03T10:00:00Z" },
    ];
    expect(sortAnnouncements(rows).map((r) => r.id)).toEqual(["b", "c", "a"]);
  });
});

describe("sortQuestions", () => {
  it("sorts open before answered, then by created_at desc", () => {
    const rows = [
      { id: "a", status: "answered" as const, created_at: "2026-01-03T10:00:00Z" },
      { id: "b", status: "open" as const, created_at: "2026-01-01T10:00:00Z" },
      { id: "c", status: "open" as const, created_at: "2026-01-02T10:00:00Z" },
    ];
    expect(sortQuestions(rows).map((r) => r.id)).toEqual(["c", "b", "a"]);
  });
});
