import { describe, expect, it } from "vitest";
import { countUnreadAnnouncements } from "@/lib/department-board/unread";

describe("countUnreadAnnouncements", () => {
  it("counts announcements without read marker", () => {
    expect(
      countUnreadAnnouncements({
        announcements: [
          { id: "a1" } as never,
          { id: "a2" } as never,
        ],
        readAnnouncementIds: ["a1"],
      })
    ).toBe(1);
  });
});
